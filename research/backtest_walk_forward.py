"""
FOMOMETER · walk-forward backtest harness.

Re-implements the production fallback (weighted-sum on the 12 TS factors)
in pure Python so we can sweep weights and BUY/SELL thresholds against the
real `signal_outcomes` table — and emit a production-ready
`infra/best_meme_strategy.json`.

Why pure Python (no torch / Optuna)?
  - Portable: runs on any laptop with stdlib + numpy + pandas.
  - The 12-factor space is small enough that random search converges.
  - The TS engine is the source of truth; we mirror its math 1:1.

Usage
-----
1. Export D1 to a local SQLite file:
   wrangler d1 export fomometer --output ./data/fomometer.sqlite

2. Run the harness:
   python research/backtest_walk_forward.py \\
       --db ./data/fomometer.sqlite \\
       --output infra/best_meme_strategy.json \\
       --trials 400

3. Inspect the report (printed) and `--report` JSON if requested.

Outputs
-------
  - JSON strategy file shaped like infra/best_meme_strategy.json.example,
    but with a `weights` block (not StackVM tokens — we keep tokens=[] so
    the worker falls through to fallback with the new weights).
  - A console summary with Sharpe, hit-rate, precision, and chosen
    BUY / SELL thresholds.

Hooking weights into the engine
-------------------------------
The engine (workers/engine/src/index.ts) loads STRATEGY_FORMULA_JSON.
This script extends that JSON with `meta.fallback_weights`. To consume,
patch loadStrategy() to read meta.fallback_weights and pass them to
computeScore (already supported by the new fallbackScore signature).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sqlite3
import sys
from dataclasses import asdict, dataclass, field
from typing import Iterable, Optional

try:
    import numpy as np
    import pandas as pd
except ImportError:
    print("ERROR: numpy and pandas required. pip install numpy pandas", file=sys.stderr)
    raise


EPS = 1e-9
FACTOR_KEYS = [
    "ret", "liq_score", "pressure", "fomo", "dev", "log_vol",
    "vol_cluster", "momentum_rev", "rel_strength", "hl_range", "close_pos", "vol_trend",
]


# ---------------------------------------------------------------------------
# Factor computation · MUST match packages/shared/src/engine/factors.ts.
# ---------------------------------------------------------------------------

def _safe_log(x: float) -> float:
    return math.log(max(EPS, x))


def _tanh(x: float) -> float:
    if not math.isfinite(x):
        return 0.0
    if x > 20:
        return 1.0
    if x < -20:
        return -1.0
    return math.tanh(x)


def _mean(arr: list[float]) -> float:
    return sum(arr) / len(arr) if arr else 0.0


def _std(arr: list[float]) -> float:
    if len(arr) < 2:
        return 0.0
    m = _mean(arr)
    return math.sqrt(sum((x - m) ** 2 for x in arr) / len(arr))


def _log_returns(prices: list[float]) -> list[float]:
    return [_safe_log(prices[i]) - _safe_log(prices[i - 1]) for i in range(1, len(prices))]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def compute_factors(window: pd.DataFrame) -> list[float]:
    """Mirror of packages/shared/src/engine/factors.ts:computeFactors."""
    if window.empty:
        return [0.0] * 12

    last = window.iloc[-1]
    n = len(window)
    prices = window["price_usd"].tolist()

    ret = (
        _safe_log(prices[-1]) - _safe_log(prices[-2])
        if n >= 2
        else 0.0
    )

    fdv = float(last.get("fdv") or 0)
    liq = float(last.get("liquidity_usd") or 0)
    liq_score = _clamp((liq / fdv) * 4, 0, 1) if fdv >= 1 else 0.0

    b = float(last.get("buys_h1") or 0)
    s = float(last.get("sells_h1") or 0)
    pressure = _tanh(((b - s) / (b + s)) * 3) if (b + s) >= 1 else 0.0

    v5 = float(last.get("volume_m5") or 0)
    v1h = float(last.get("volume_h1") or 0)
    fomo = _clamp((v5 * 12 - v1h) / (v1h + 1), -5, 5) if v1h >= 1 else 0.0

    if n >= 2:
        ma_window = prices[-min(n, 20):]
        ma = _mean(ma_window)
        dev = (last["price_usd"] - ma) / (ma if abs(ma) > EPS else EPS)
    else:
        dev = 0.0

    log_vol = math.log1p(max(0, v1h))

    if n >= 3:
        recent = prices[-min(n, 11):]
        vol_cluster = _std(_log_returns(recent))
    else:
        vol_cluster = 0.0

    if n >= 11:
        r = _log_returns(prices[-11:])
        recent_sum = sum(r[-5:])
        prev_sum = sum(r[-10:-5])
        momentum_rev = 1.0 if recent_sum * prev_sum < 0 else 0.0
    else:
        momentum_rev = 0.0

    if n >= 15:
        r = _log_returns(prices[-15:])
        gains = sum(x for x in r if x > 0)
        losses = -sum(x for x in r if x < 0)
        avg_g = gains / 14
        avg_l = losses / 14
        rs = (avg_g + EPS) / (avg_l + EPS)
        rsi = 100 - 100 / (1 + rs)
        rel_strength = (rsi - 50) / 50
    else:
        rel_strength = 0.0

    hl_range = abs(float(last.get("price_change_h1") or 0)) / 100

    if n >= 2:
        hourly = prices[-min(n, 60):]
        lo, hi = min(hourly), max(hourly)
        close_pos = _clamp((last["price_usd"] - lo) / (hi - lo), 0, 1) if hi - lo > EPS else 0.5
    else:
        close_pos = 0.5

    v6 = float(last.get("volume_h6") or 0)
    vol_trend = _clamp((v1h - v6 / 6) / (v6 / 6 + 1), -5, 5) if v6 >= 1 else 0.0

    out = [
        ret, liq_score, pressure, fomo, dev, log_vol,
        vol_cluster, momentum_rev, rel_strength, hl_range, close_pos, vol_trend,
    ]
    return [v if math.isfinite(v) else 0.0 for v in out]


# ---------------------------------------------------------------------------
# Scoring · matches packages/shared/src/engine/score.ts.
# ---------------------------------------------------------------------------

WEIGHT_KEYS = [
    "fomo", "pressure", "momentum_rev", "liq_score",
    "vol_trend", "rel_strength", "dev",
]
WEIGHT_TO_FACTOR_IDX = {
    "fomo": 3, "pressure": 2, "momentum_rev": 7, "liq_score": 1,
    "vol_trend": 11, "rel_strength": 8, "dev": 4,
}
DEFAULT_WEIGHTS = {
    "fomo": 0.30, "pressure": 0.20, "momentum_rev": 0.15, "liq_score": 0.10,
    "vol_trend": 0.10, "rel_strength": 0.10, "dev": 0.05,
}


def sigmoid(x: float) -> float:
    if x > 30:
        return 1.0
    if x < -30:
        return 0.0
    return 1 / (1 + math.exp(-x))


def fallback_score(factors: list[float], weights: dict[str, float]) -> float:
    x = sum(weights[k] * factors[WEIGHT_TO_FACTOR_IDX[k]] for k in WEIGHT_KEYS)
    return sigmoid(x)


# ---------------------------------------------------------------------------
# Walk-forward harness.
# ---------------------------------------------------------------------------

@dataclass
class Trial:
    weights: dict[str, float]
    buy_th: float
    sell_th: float
    sharpe: float = 0.0
    hit_rate: float = 0.0
    precision_buy: float = 0.0
    n_buys: int = 0
    avg_pnl_pct: float = 0.0
    drawdown_pct: float = 0.0


@dataclass
class Report:
    train_range: tuple[int, int]
    val_range: tuple[int, int]
    test_range: tuple[int, int]
    best: Trial
    test_metrics: dict[str, float]
    n_trials: int
    n_outcomes: int


def load_outcomes(db_path: str) -> pd.DataFrame:
    """Load labeled signal_outcomes from the SQLite snapshot.

    Factors come from the outcome itself (stored since 2026-10-15, never pruned) and,
    for older rows, from the signals table (kept 72 h). Outcomes with a price_flag
    (suspect pool switch) are left out.
    """
    if not os.path.exists(db_path):
        raise FileNotFoundError(
            f"D1 snapshot not found at {db_path}. "
            "Export with: wrangler d1 export fomometer --output ./data/fomometer.sqlite"
        )
    con = sqlite3.connect(db_path)
    try:
        return pd.read_sql_query(
            """
            SELECT o.event_id, o.address, o.event_time, o.event_type,
                   o.entry_price, o.pnl_pct_15m, o.pnl_pct_1h, o.pnl_pct_4h,
                   o.max_pnl_pct_4h, o.min_pnl_pct_4h,
                   s.score,
                   COALESCE(json_extract(o.factors_json, '$.scored'), s.factors_json) AS factors_json
              FROM signal_outcomes o
              LEFT JOIN signals s
                ON s.address = o.address AND s.time = o.event_time
             WHERE o.price_flag IS NULL
            """,
            con,
        )
    finally:
        con.close()


def parse_factor_row(factors_json: str | None) -> Optional[list[float]]:
    if not factors_json:
        return None
    try:
        obj = json.loads(factors_json)
    except json.JSONDecodeError:
        return None
    return [float(obj.get(k, 0.0)) for k in FACTOR_KEYS]


def split_by_time(df: pd.DataFrame, ratios: tuple[float, float, float]) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    df = df.sort_values("event_time").reset_index(drop=True)
    n = len(df)
    a = int(n * ratios[0])
    b = a + int(n * ratios[1])
    return df.iloc[:a].copy(), df.iloc[a:b].copy(), df.iloc[b:].copy()


def evaluate(df: pd.DataFrame, weights: dict[str, float], buy_th: float, sell_th: float, horizon: str = "pnl_pct_1h") -> Trial:
    """For each event, recompute score with these weights; if score >= buy_th
    treat as a long entry and book the realized PnL at the chosen horizon."""
    if df.empty:
        return Trial(weights=weights, buy_th=buy_th, sell_th=sell_th)

    pnls: list[float] = []
    n_buys = 0
    n_wins = 0

    for _, row in df.iterrows():
        factors = parse_factor_row(row["factors_json"])
        if factors is None:
            continue
        score = fallback_score(factors, weights)
        if score < buy_th:
            continue
        n_buys += 1
        pnl = row.get(horizon)
        if pnl is None or not math.isfinite(pnl):
            continue
        pnls.append(float(pnl))
        if pnl > 0:
            n_wins += 1

    if n_buys == 0 or not pnls:
        return Trial(weights=weights, buy_th=buy_th, sell_th=sell_th, n_buys=n_buys)

    arr = np.array(pnls)
    mean = float(arr.mean())
    std = float(arr.std()) or EPS
    sharpe = mean / std * math.sqrt(len(arr))
    cum = np.cumsum(arr)
    peak = np.maximum.accumulate(cum)
    drawdown = float((cum - peak).min())

    return Trial(
        weights=weights,
        buy_th=buy_th,
        sell_th=sell_th,
        sharpe=sharpe,
        hit_rate=n_wins / max(1, len(pnls)),
        precision_buy=n_wins / max(1, n_buys),
        n_buys=n_buys,
        avg_pnl_pct=mean,
        drawdown_pct=drawdown,
    )


def random_weights(rng: random.Random) -> dict[str, float]:
    """Sample a weight vector. Magnitudes follow the production prior so we
    explore a useful neighborhood (and not tiny / huge weights)."""
    raw = {k: rng.uniform(0.0, 0.4) for k in WEIGHT_KEYS}
    s = sum(raw.values()) or 1.0
    return {k: v / s for k, v in raw.items()}


def random_thresholds(rng: random.Random) -> tuple[float, float]:
    buy = rng.uniform(0.55, 0.85)
    sell = rng.uniform(0.15, 0.45)
    return buy, sell


def run_search(
    train: pd.DataFrame,
    val: pd.DataFrame,
    n_trials: int,
    seed: int,
    horizon: str,
) -> tuple[Trial, list[Trial]]:
    rng = random.Random(seed)
    candidates: list[Trial] = []

    # Always include the production default as a baseline.
    candidates.append(evaluate(val, DEFAULT_WEIGHTS, 0.7, 0.3, horizon))

    for _ in range(n_trials):
        w = random_weights(rng)
        buy, sell = random_thresholds(rng)
        # Train just to keep the API symmetric — we score on val.
        _ = evaluate(train, w, buy, sell, horizon)
        v = evaluate(val, w, buy, sell, horizon)
        # Require at least 20 entries on val to avoid lottery winners.
        if v.n_buys < 20:
            continue
        candidates.append(v)

    if not candidates:
        raise RuntimeError("No valid trials — increase --trials or check data.")

    # Rank by Sharpe, break ties by precision.
    candidates.sort(key=lambda t: (t.sharpe, t.precision_buy), reverse=True)
    return candidates[0], candidates


def write_strategy_json(path: str, best: Trial, report: Report) -> None:
    payload = {
        "tokens": [],  # empty → engine uses fallback path with our weights
        "trained_at": pd.Timestamp.utcnow().isoformat(),
        "meta": {
            "trainer": "walk_forward_v1",
            "fallback_weights": best.weights,
            "thresholds": {"buy": best.buy_th, "sell": best.sell_th},
            "metrics": {
                "val": {
                    "sharpe": best.sharpe,
                    "hit_rate": best.hit_rate,
                    "precision_buy": best.precision_buy,
                    "n_buys": best.n_buys,
                    "avg_pnl_pct": best.avg_pnl_pct,
                    "drawdown_pct": best.drawdown_pct,
                },
                "test": report.test_metrics,
            },
            "split": {
                "train": list(report.train_range),
                "val": list(report.val_range),
                "test": list(report.test_range),
            },
            "n_trials": report.n_trials,
            "n_outcomes": report.n_outcomes,
        },
    }
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as fh:
        json.dump(payload, fh, indent=2)


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--db", required=True, help="Path to SQLite snapshot of D1")
    p.add_argument("--output", default="infra/best_meme_strategy.json")
    p.add_argument("--report", default=None, help="Optional JSON report path")
    p.add_argument("--trials", type=int, default=300)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--horizon", default="pnl_pct_1h",
                   choices=["pnl_pct_15m", "pnl_pct_1h", "pnl_pct_4h"])
    p.add_argument("--ratios", default="0.6,0.2,0.2",
                   help="train,val,test fractions (must sum to 1.0)")
    args = p.parse_args(argv)

    ratios = tuple(float(x) for x in args.ratios.split(","))
    if abs(sum(ratios) - 1.0) > 1e-6 or len(ratios) != 3:
        raise ValueError("--ratios must be three numbers summing to 1")

    df = load_outcomes(args.db)
    if df.empty:
        print("ERROR: no labeled outcomes yet — let the labeler cron run first.", file=sys.stderr)
        return 2
    df = df.dropna(subset=["factors_json", args.horizon])

    train, val, test = split_by_time(df, ratios)
    if any(part.empty for part in (train, val, test)):
        print("ERROR: at least one split is empty — collect more outcome data.", file=sys.stderr)
        return 2

    print(f"data: total={len(df)} train={len(train)} val={len(val)} test={len(test)} horizon={args.horizon}")

    best, _all = run_search(train, val, args.trials, args.seed, args.horizon)
    test_trial = evaluate(test, best.weights, best.buy_th, best.sell_th, args.horizon)
    test_metrics = {
        "sharpe": test_trial.sharpe,
        "hit_rate": test_trial.hit_rate,
        "precision_buy": test_trial.precision_buy,
        "n_buys": test_trial.n_buys,
        "avg_pnl_pct": test_trial.avg_pnl_pct,
        "drawdown_pct": test_trial.drawdown_pct,
    }

    report = Report(
        train_range=(int(train["event_time"].min()), int(train["event_time"].max())),
        val_range=(int(val["event_time"].min()), int(val["event_time"].max())),
        test_range=(int(test["event_time"].min()), int(test["event_time"].max())),
        best=best,
        test_metrics=test_metrics,
        n_trials=args.trials,
        n_outcomes=len(df),
    )

    write_strategy_json(args.output, best, report)

    print()
    print("=== best on validation ===")
    for k, v in asdict(best).items():
        print(f"  {k}: {v}")
    print()
    print("=== held-out test ===")
    for k, v in test_metrics.items():
        print(f"  {k}: {v}")
    print()
    print(f"strategy written to {args.output}")

    if args.report:
        with open(args.report, "w") as fh:
            json.dump(
                {
                    "best": asdict(best),
                    "test": test_metrics,
                    "split": {
                        "train": list(report.train_range),
                        "val": list(report.val_range),
                        "test": list(report.test_range),
                    },
                },
                fh,
                indent=2,
                default=float,
            )
        print(f"report written to {args.report}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
