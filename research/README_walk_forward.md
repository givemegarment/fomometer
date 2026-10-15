# Walk-forward training pipeline

End-to-end loop for re-fitting the FOMOMETER engine on the data the engine
itself produced.

```
Production engine ──▶ token_snapshots ──▶ signals + signal_events
                                                │
                                          (4h lookahead)
                                                ▼
                                        signal_outcomes  ◀── labeler cron
                                                │
                                       wrangler d1 export
                                                ▼
                                  research/backtest_walk_forward.py
                                                │
                                  best_meme_strategy.json (weights + thresholds)
                                                │
                              wrangler secret put STRATEGY_FORMULA_JSON
                                                ▼
                                    Production engine (refreshed)
```

## Components

| Layer | Path | Cron | Purpose |
|---|---|---|---|
| Engine | `workers/engine/src/index.ts` | `*/1 * * * *` | Snapshot DexScreener, score, emit BUY/SELL/FOMO events |
| Labeler | `workers/labeler/src/index.ts` | `*/15 * * * *` | Auto-label each event with 15m / 1h / 4h forward PnL |
| Trainer | `research/backtest_walk_forward.py` | manual / weekly | Random-search fallback weights + thresholds |
| Dashboard | `apps/web/app/api/strategy/accuracy` + `/dashboard/strategy` | live | Surface precision / hit-rate / regime / current thresholds |

## Engine flags (defaults: all on)

| Flag | Effect |
|---|---|
| `ENGINE_CROSS_SECTIONAL_NORM=true` | Z-score every factor against the universe at each tick — kills market-wide false positives |
| `ENGINE_ADAPTIVE_THRESHOLDS=true`  | BUY = 75th / SELL = 25th percentile of recent scores; FOMO = 95th percentile (floor 1.5) |
| `ENGINE_REGIME_AWARE=true`         | Detect bull / bear / panic from score distribution + vol_trend; modulate fallback weights |

Plus a 30-min warm-up gate · BUY/SELL transitions don't fire until a token has 30 snapshots
(stops noise from short-history tokens).

## One-shot training

```bash
# 1. Apply latest schema (idempotent — adds signal_outcomes if missing)
pnpm d1:apply:remote

# 2. Deploy the labeler so outcomes start filling in 4 h after the next event
pnpm deploy:labeler

# 3. After ≥ ~3 days of accumulated outcomes (≥ 200 labeled events),
#    pull the data locally and refit:
pnpm d1:export
pnpm train:walk-forward

# 4. Push the resulting strategy as a worker secret. The engine reads it and
#    swaps in the trained weights + thresholds on the next run.
wrangler secret put STRATEGY_FORMULA_JSON --name fomometer-engine \
    < infra/best_meme_strategy.json
```

## Data flow contract

`backtest_walk_forward.py` ports `packages/shared/src/engine/factors.ts` and
`score.ts` 1:1 to Python. If you change the TS factor set or scoring formula,
update the Python mirror **in the same commit** — the comment block at the
top of `backtest_walk_forward.py` calls this out.

The trainer emits a `best_meme_strategy.json` with this shape:

```json
{
  "tokens": [],
  "trained_at": "2026-05-07T12:34:56+00:00",
  "meta": {
    "trainer": "walk_forward_v1",
    "fallback_weights": { "fomo": 0.31, "pressure": 0.18, ... },
    "thresholds": { "buy": 0.72, "sell": 0.28 },
    "metrics": { "val": { ... }, "test": { ... } },
    "split": { "train": [...], "val": [...], "test": [...] }
  }
}
```

`tokens=[]` is intentional · the engine sees `meta.fallback_weights`, picks
the trained weights, and runs through the well-tested fallback path. When we
graduate to a real StackVM formula (re-running `AlphaGPT/model_core/engine.py`
on the same outcome data), `tokens` will be filled and the VM path takes over.

## What "good" looks like

For paper-trading promotion we want, on the held-out test slice:

| Horizon | precision | avg PnL | n events |
|---|---|---|---|
| 1 h | ≥ 55 % | ≥ +1.0 % | ≥ 100 |
| 4 h | ≥ 50 % | ≥ +2.0 % | ≥ 100 |

The accuracy panel on `/dashboard/strategy` shows live numbers from the same
table the trainer reads — no separate report file to ship.

## Re-training cadence

Run `pnpm d1:export && pnpm train:walk-forward` on a weekly cron (manually for
now). Only swap `STRATEGY_FORMULA_JSON` if the new test Sharpe is at least 5 %
better than the version recorded in the previous strategy's `meta.metrics.test`.

## Files touched by this pipeline

```
infra/d1-schema.sql                              · adds signal_outcomes table
infra/best_meme_strategy.json                    · output of the trainer (worker secret)
workers/engine/src/index.ts                      · normalization · regime · adaptive thresholds · weight loading
workers/labeler/                                 · new cron worker
packages/shared/src/engine/factors.ts            · computePopulationStats / normalizeByPopulation
packages/shared/src/engine/score.ts              · adaptiveThresholds · detectMarketRegime · regimeAdjustedWeights
apps/web/app/api/strategy/accuracy/route.ts      · accuracy aggregates
apps/web/components/dashboard/strategy-client.tsx · accuracy panel
research/backtest_walk_forward.py           · the trainer
```
