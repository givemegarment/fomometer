"""
FOMOMETER · walk-forward trainer (stdlib-only variant).

Same contract as backtest_walk_forward.py but doesn't depend on numpy / pandas.
Reads outcomes from a JSON dump (produced via `wrangler d1 execute --json`)
instead of a SQLite snapshot. For 500-50k events, pure Python is plenty fast
and runs on any laptop without `pip install`.

Usage
-----
    # 1. Dump outcomes + signals as JSON
    pnpm exec wrangler d1 execute fomometer --remote --json --command=" \\
        SELECT o.event_id, o.address, o.event_time, o.event_type, \\
               o.pnl_pct_15m, o.pnl_pct_1h, o.pnl_pct_4h, \\
               o.max_pnl_pct_4h, o.min_pnl_pct_4h, \\
               s.score, s.factors_json \\
        FROM signal_outcomes o \\
        LEFT JOIN signals s ON s.address=o.address AND s.time=o.event_time" \\
        | python3 -c "import sys,json; \\
            d=json.loads(sys.stdin.read()); \\
            json.dump(d[0]['results'], open('data/outcomes.json','w'))"

    # 2. Train
    python3 research/backtest_walk_forward_stdlib.py \\
        --input data/outcomes.json \\
        --output infra/best_meme_strategy.json \\
        --trials 800

The output JSON has tokens=[] and meta.fallback_weights / meta.thresholds /
meta.metrics — engine consumes meta.fallback_weights via STRATEGY_FORMULA_JSON.
"""
from __future__ import annotations

import argparse
import datetime
import json
import math
import os
import random
import statistics
import sys
from dataclasses import asdict, dataclass


# Same factor order and weight keys as packages/shared/src/engine/score.ts.
WEIGHT_KEYS = ["fomo", "pressure", "momentum_rev", "liq_score",
               "vol_trend", "rel_strength", "dev"]

DEFAULT_WEIGHTS = {
    "fomo": 0.30, "pressure": 0.20, "momentum_rev": 0.15, "liq_score": 0.10,
    "vol_trend": 0.10, "rel_strength": 0.10, "dev": 0.05,
}


def sigmoid(x: float) -> float:
    if x > 30: return 1.0
    if x < -30: return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def fallback_score(factors: dict, weights: dict) -> float:
    x = sum(weights[k] * float(factors.get(k, 0.0)) for k in WEIGHT_KEYS)
    return sigmoid(x)


@dataclass
class Trial:
    weights: dict
    buy_th: float
    sell_th: float
    sharpe: float = 0.0
    hit_rate: float = 0.0
    precision_buy: float = 0.0
    n_buys: int = 0
    avg_pnl_pct: float = 0.0
    drawdown_pct: float = 0.0


def load_rows(path: str) -> list:
    rows = json.load(open(path))
    out = []
    for r in rows:
        if not r.get("factors_json"): continue
        try:
            r["factors"] = json.loads(r["factors_json"])
        except Exception:
            continue
        out.append(r)
    out.sort(key=lambda r: r.get("event_time", 0))
    return out


def split_by_time(rows: list, ratios=(0.6, 0.2, 0.2)) -> tuple:
    n = len(rows)
    a = int(n * ratios[0])
    b = a + int(n * ratios[1])
    return rows[:a], rows[a:b], rows[b:]


def evaluate(rows: list, weights: dict, buy_th: float, sell_th: float,
             horizon_key: str = "pnl_pct_1h") -> Trial:
    pnls = []
    n_buys = 0
    n_wins = 0
    for r in rows:
        score = fallback_score(r["factors"], weights)
        if score < buy_th: continue
        n_buys += 1
        pnl = r.get(horizon_key)
        if pnl is None: continue
        try:
            pnl = float(pnl)
        except Exception:
            continue
        if not math.isfinite(pnl): continue
        pnls.append(pnl)
        if pnl > 0: n_wins += 1

    if not pnls:
        return Trial(weights=weights, buy_th=buy_th, sell_th=sell_th, n_buys=n_buys)

    mean = statistics.fmean(pnls)
    sd = statistics.pstdev(pnls) if len(pnls) > 1 else 0.0
    sharpe = (mean / sd) * math.sqrt(len(pnls)) if sd > 1e-9 else 0.0

    cum = 0.0
    peak = 0.0
    drawdown = 0.0
    for p in pnls:
        cum += p
        if cum > peak: peak = cum
        if cum - peak < drawdown: drawdown = cum - peak

    return Trial(
        weights=weights, buy_th=buy_th, sell_th=sell_th,
        sharpe=sharpe,
        hit_rate=n_wins / max(1, len(pnls)),
        precision_buy=n_wins / max(1, n_buys),
        n_buys=n_buys,
        avg_pnl_pct=mean,
        drawdown_pct=drawdown,
    )


def random_weights(rng: random.Random) -> dict:
    raw = {k: rng.uniform(0.0, 0.4) for k in WEIGHT_KEYS}
    s = sum(raw.values()) or 1.0
    return {k: v / s for k, v in raw.items()}


def random_thresholds(rng: random.Random) -> tuple:
    return rng.uniform(0.55, 0.85), rng.uniform(0.15, 0.45)


def run_search(train: list, val: list, n_trials: int, seed: int,
               horizon: str, min_buys: int):
    rng = random.Random(seed)
    candidates = [evaluate(val, DEFAULT_WEIGHTS, 0.7, 0.3, horizon)]

    for _ in range(n_trials):
        w = random_weights(rng)
        buy, sell = random_thresholds(rng)
        v = evaluate(val, w, buy, sell, horizon)
        if v.n_buys < min_buys: continue
        candidates.append(v)

    if not candidates:
        raise RuntimeError("No valid trials — check data or lower min_buys.")
    candidates.sort(key=lambda t: (t.sharpe, t.precision_buy, t.avg_pnl_pct), reverse=True)
    return candidates[0], candidates


def write_strategy(path: str, best: Trial, test: Trial, n_trials: int,
                   horizon: str, n_outcomes: int):
    payload = {
        "tokens": [],
        "trained_at": datetime.datetime.utcnow().isoformat() + "Z",
        "meta": {
            "trainer": "walk_forward_stdlib_v1",
            "horizon": horizon,
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
                "test": {
                    "sharpe": test.sharpe,
                    "hit_rate": test.hit_rate,
                    "precision_buy": test.precision_buy,
                    "n_buys": test.n_buys,
                    "avg_pnl_pct": test.avg_pnl_pct,
                    "drawdown_pct": test.drawdown_pct,
                },
            },
            "n_trials": n_trials,
            "n_outcomes": n_outcomes,
        },
    }
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as fh:
        json.dump(payload, fh, indent=2)


def main(argv):
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="JSON dump of signal_outcomes JOIN signals")
    p.add_argument("--output", default="infra/best_meme_strategy.json")
    p.add_argument("--trials", type=int, default=800)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--horizon", default="pnl_pct_1h",
                   choices=["pnl_pct_15m", "pnl_pct_1h", "pnl_pct_4h"])
    p.add_argument("--min-buys", type=int, default=15,
                   help="reject trials that fire fewer than N buys on val (avoids lottery winners)")
    p.add_argument("--ratios", default="0.6,0.2,0.2")
    args = p.parse_args(argv)

    ratios = tuple(float(x) for x in args.ratios.split(","))
    if abs(sum(ratios) - 1.0) > 1e-6 or len(ratios) != 3:
        raise SystemExit("--ratios must be three numbers summing to 1")

    rows = load_rows(args.input)
    if not rows:
        raise SystemExit("ERROR: no usable rows in input")

    train, val, test = split_by_time(rows, ratios)
    if not train or not val or not test:
        raise SystemExit("ERROR: at least one split is empty")

    print(f"data: total={len(rows)} train={len(train)} val={len(val)} test={len(test)} horizon={args.horizon}")

    # Baseline on val for context.
    base = evaluate(val, DEFAULT_WEIGHTS, 0.7, 0.3, args.horizon)
    print(f"baseline (default weights, 0.7/0.3) on val: "
          f"sharpe={base.sharpe:.3f} win={base.hit_rate:.0%} "
          f"avg={base.avg_pnl_pct:.2f}% n_buys={base.n_buys}")

    best, _ = run_search(train, val, args.trials, args.seed, args.horizon, args.min_buys)
    test_t = evaluate(test, best.weights, best.buy_th, best.sell_th, args.horizon)

    print()
    print("=== best on validation ===")
    for k, v in asdict(best).items():
        if isinstance(v, float): print(f"  {k}: {v:.4f}")
        elif isinstance(v, dict): print(f"  {k}: { {kk: round(vv, 3) for kk, vv in v.items()} }")
        else: print(f"  {k}: {v}")

    print()
    print("=== held-out test ===")
    for k, v in asdict(test_t).items():
        if k == "weights": continue
        if isinstance(v, float): print(f"  {k}: {v:.4f}")
        else: print(f"  {k}: {v}")

    write_strategy(args.output, best, test_t, args.trials, args.horizon, len(rows))
    print()
    print(f"strategy written to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
