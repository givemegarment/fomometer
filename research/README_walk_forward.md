# Walk-forward training pipeline

Refits the score's weights and BUY/SELL thresholds on the outcomes the engine itself produced.

```
engine (every minute) ──▶ token_snapshots, signals, signal_events (factors in metadata_json)
                                              │
                                   labeler (every 15 min, after the 4 h horizon)
                                              ▼
                     signal_outcomes: prices at 15 m / 1 h / 4 h, best and worst move,
                     price_flag, factors_json (kept forever)
                                              │
                          dump (wrangler d1 execute --json) or d1 export
                                              ▼
                     research/backtest_walk_forward_stdlib.py  (or backtest_walk_forward.py)
                                              │
                     infra/best_meme_strategy.json (weights + thresholds + metrics)
                                              │
                     wrangler secret put STRATEGY_FORMULA_JSON
                                              ▼
                     engine uses the new weights on its next run
```

## Components

| Layer | Path | Schedule | Purpose |
|---|---|---|---|
| Engine | `workers/engine/src/index.ts` | every minute | Snapshot DexScreener, score, emit BUY / SELL / volume-burst events with both factor vectors |
| Labeler | `workers/labeler/src/index.ts` | every 15 min | Price each event at 15 m, 1 h and 4 h, copy its factors, flag suspect prices |
| Trainer | `research/backtest_walk_forward_stdlib.py` | by hand | Random search over fallback weights and BUY/SELL thresholds; standard library only |
| Trainer (SQLite) | `research/backtest_walk_forward.py` | by hand | Same search, reads a `d1 export` file |
| Track record | `apps/web/app/api/strategy/route.ts`, `/dashboard/strategy` | live | Outcome statistics from the same table |

## What the training data contains

- **Factors.** Since 2026-10-15 every event stores `{"scored": {...}, "raw": {...}}`: the vector the score used (after cross-sectional normalization) and the raw one. The labeler copies it to `signal_outcomes.factors_json`, which is never pruned. Outcomes from about 2026-10-12 (the 72 hours still in `signals` on 2026-10-15) were backfilled with `scored` only (`infra/migrations/2026-10-15-backfill-factors.sql`). Older outcomes have no factors. The trainer queries take `factors_json.scored` first and fall back to `signals`.
- **Lost outcomes.** `price_4h IS NULL` means no snapshot within 10 minutes after the 4 h horizon. Since 2026-10-15 the engine keeps snapshotting a token for 4 h 10 m after it was last scored, even when it leaves the boosted lists, so this should be rare for new events and baseline samples. Older history loses about 40 % of 4 h prices this way.
- **Suspect prices.** `price_flag = 'rise_over_1000pct'` when the best price inside the 4 h window is more than 11× entry. On DexScreener this is almost always a switch to a different pool. The trainer queries exclude these rows; older rows were flagged by the same rule when the column was added.

## Baseline

`baseline_outcomes` holds every scored token once per 30 minutes, priced exactly like an event (since 2026-10-15). A new strategy has to beat it over the same window.

## Engine settings that matter for training

| Setting | Effect |
|---|---|
| `ENGINE_CROSS_SECTIONAL_NORM=true` | Each factor is z-scored against the other tokens at the same minute, clamped to ±5 |
| `ENGINE_ADAPTIVE_THRESHOLDS=true` | Without trained thresholds: BUY at the 75th and SELL at the 25th percentile of scores over 6 h. Volume burst: 95th percentile of the raw burst factor (`signals.fomo_raw`) over 6 h, floor 1.5 |
| `ENGINE_REGIME_AWARE=true` | Bull / bear / panic detection adjusts the weights |
| `ENGINE_WARM_UP_MIN=10` | No events until a token has 10 snapshots in the 90-minute window |
| Quality filter | Liquidity ≥ $25k, buy/sell ratio 0.8 to 3.0, no events after a 50–100 % hour. Events only; scores are still written |

Trained thresholds (`meta.thresholds`) take priority over the adaptive BUY/SELL percentiles.

## Training run

```bash
# 1. Dump outcomes (the exact query is in the header of backtest_walk_forward_stdlib.py)
# 2. Fit
python3 research/backtest_walk_forward_stdlib.py --input data/outcomes.json \
    --output infra/best_meme_strategy.candidate.json --trials 1500
# 3. Compare the candidate's test metrics with the current strategy's, then publish:
npx wrangler secret put STRATEGY_FORMULA_JSON -c workers/engine/wrangler.toml \
    < infra/best_meme_strategy.json
```

`data/` and `infra/best_meme_strategy*.json` are git-ignored: they hold production data and fitted weights. The current weights are public on the Strategy page anyway.

Output shape:

```json
{
  "tokens": [],
  "trained_at": "2026-05-07T12:34:56+00:00",
  "meta": {
    "trainer": "walk_forward_v1",
    "fallback_weights": { "fomo": 0.31, "pressure": 0.18 },
    "thresholds": { "buy": 0.72, "sell": 0.28 },
    "metrics": { "val": {}, "test": {} },
    "split": { "train": [], "val": [], "test": [] }
  }
}
```

`tokens=[]` makes the engine use the weighted-sum score with `meta.fallback_weights`.

## Keeping Python and TypeScript in sync

The trainers re-implement the weighted-sum score from `packages/shared/src/engine/score.ts`. A change to the factor set or the score formula needs the same change in both trainers in the same commit.

## When to ship a new strategy

Only when it beats the baseline (all tracked tokens over the same window) on the held-out test split, after an allowance for fees and slippage. See phase 3 of [docs/ROADMAP.md](../docs/ROADMAP.md).
