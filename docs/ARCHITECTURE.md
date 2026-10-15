# Architecture

FOMOMETER is three programs sharing one database, all on Cloudflare.

```
                 DexScreener API (public, no key)
                          │  every minute
                          ▼
┌──────────────────────────────────────────────┐
│ workers/engine            cron */1 * * * *    │
│ 1. read boosted-token lists, keep Solana      │
│ 2. fetch pairs, upsert tokens, write snapshots│
│ 3. 12 factors per token from 90 min of history│
│ 4. z-score across tokens, score, regime       │
│ 5. BUY / SELL / volume-burst events           │
│ 6. prune data older than 72 h                 │
└──────────────────────┬───────────────────────┘
                       ▼
               Cloudflare D1 (SQLite)
                 ▲                 ▲
                 │ every 15 min    │ read-only SELECTs
┌────────────────┴───────┐  ┌──────┴─────────────────────────┐
│ workers/labeler        │  │ apps/web (Next.js 14, Pages)    │
│ price 15m / 1h / 4h    │  │ landing, /how-it-works,         │
│ after each event       │  │ dashboard, JSON API             │
└────────────────────────┘  └─────────────────────────────────┘
```

## Components

| Component | Runtime | Schedule | Code |
|---|---|---|---|
| Engine | Cloudflare Worker `fomometer-engine` | every minute | `workers/engine/src/index.ts` |
| Labeler | Cloudflare Worker `fomometer-labeler` | every 15 minutes | `workers/labeler/src/index.ts` |
| Site and API | Cloudflare Pages `fomometer-web`, edge runtime | on request | `apps/web` |
| Shared math | TypeScript package `@fomometer/shared` | | `packages/shared/src/engine` |
| Trainer | Python, run by hand | | `research/backtest_walk_forward_stdlib.py` |

The site never writes to the database. The watchlist lives in the visitor's browser (`localStorage`, key `fomo_watchlist`). There are no accounts.

## Engine cycle

One run per minute, inside the Workers free-plan CPU limit (50 ms). Measured after the October 2026 rewrite: 15 to 57 ms CPU, 1.4 to 3.7 s wall time, mostly waiting on DexScreener and D1.

1. **Universe.** Token-boost lists (top and latest), Solana only, up to `ENGINE_TOP_N` (50). An empty response skips the minute.
2. **Snapshots.** Pair data for each token: price, liquidity, FDV, volumes (5m, 1h, 6h, 24h), price changes, buy and sell counts. Written to `token_snapshots`. Token metadata goes to `tokens`; an empty logo from DexScreener does not overwrite a stored one.
3. **Factors.** One query loads the last 90 minutes of snapshots for every token (`json_each`). `packages/shared/src/engine/factors.ts` computes 12 factors.
4. **Normalization.** Each factor is z-scored across the tokens of this minute and capped at ±5 (`ENGINE_CROSS_SECTIONAL_NORM`).
5. **Score.** A sigmoid of a weighted sum of 7 normalized factors (`score.ts`). Weights and thresholds come from the `STRATEGY_FORMULA_JSON` secret, otherwise from defaults. A market regime (neutral, bull, bear, panic) shifts three of the weights (`ENGINE_REGIME_AWARE`).
6. **Events.** BUY when the score crosses the BUY threshold upward, SELL when it drops from above BUY to below SELL in one step, volume burst when the raw `fomo` factor beats the 95th percentile of the last 6 hours (floor 1.5, once per token per 30 minutes). Only tokens that pass the quality filter (10 snapshots, $25k liquidity, buy/sell ratio 0.8 to 3.0, not up 50 to 100% in the hour) can emit events.
7. **Writes.** All `signals` and `signal_events` rows go in one `DB.batch`. The run summary goes to `engine_state.last_run`; the burst threshold is cached in `engine_state.fomo_th` for 30 minutes.
8. **Retention.** Snapshots and signals older than 72 hours are deleted, events older than 72 hours plus 14 days.

## Labeler

Every 15 minutes it takes events without an outcome whose 4-hour horizon has passed (events 4 to 16 hours old, `LABELER_LOOKBACK_HOURS` = 12), finds the first snapshot at or after 15 minutes, 1 hour and 4 hours (accepted only within 10 minutes of the horizon), and writes `signal_outcomes` with the price changes and the best and worst move inside 4 hours. Outcomes are never pruned; they are the long-term record (45,618 rows on 2026-10-14, from 2026-05-06).

## Data model

Schema: `infra/d1-schema.sql`. Times are Unix seconds.

| Table | Rows (2026-10-14) | Kept | Purpose |
|---|---|---|---|
| `tokens` | 11,653 | forever | symbol, name, logo, pair |
| `token_snapshots` | ~133k | 72 h | one row per token per minute |
| `signals` | ~15k | 72 h | score and all 12 factors (`factors_json`) per token per minute |
| `signal_events` | ~4.4k | 72 h + 14 d | BUY, SELL, volume burst |
| `signal_outcomes` | 45,618 | forever | price after 15m / 1h / 4h per event |
| `engine_state` | 2 | | `last_run`, `fomo_th` |
| `users`, `sessions`, `watchlist` | 3, 0, 0 | | left from the Telegram-gated version, unused |

## JSON API

All routes are `GET`, edge runtime, read-only, no authentication. Prices in USD, scores 0..1 (the site shows them ×100).

| Route | Parameters | Returns |
|---|---|---|
| `/api/status` | | `snapshot_at`, `scored_at`: newest price and score times. LIVE on the site when prices are under 3 minutes old. |
| `/api/scanner` | `filter=score\|liq\|fomo`, `limit` 10..50 | `rows`: tracked tokens (snapshot within 10 minutes of the newest) with price, liquidity, score, factors, logo, `scored_at` |
| `/api/overview` | | `buy_signals_1h`, `avg_score`, `leaders`, `last_buys` |
| `/api/signals` | `type=buy\|sell\|fomo`, `limit` 20..200 | `events` with token symbol and logo |
| `/api/tokens/{address}` | | `token`, `history` (6 h of price and score), latest factors, recent events |
| `/api/strategy` | `days` 1..90 (default 7) | `settings` from `last_run` (thresholds, regime, weights) and `record`: per event type and horizon, n, share favorable, median change |
| `/api/watchlist` | `addresses` (comma-separated) | `rows` for the given addresses |

The API is public but not versioned or rate-limited; treat it as the site's internal API.

## Configuration

| Where | Name | Meaning |
|---|---|---|
| Engine `[vars]` | `ENGINE_TOP_N`, `ENGINE_CHAIN`, `ENGINE_HISTORY_RETENTION_HOURS` | universe size, chain, retention |
| Engine `[vars]` | `ENGINE_CROSS_SECTIONAL_NORM`, `ENGINE_ADAPTIVE_THRESHOLDS`, `ENGINE_REGIME_AWARE` | method switches |
| Engine `[vars]` | `ENGINE_WARM_UP_MIN`, `ENGINE_MIN_LIQUIDITY_USD`, `ENGINE_BS_RATIO_MIN/MAX`, `ENGINE_PUMP_BLOCK_LO/HI` | quality filter |
| Engine secret | `STRATEGY_FORMULA_JSON` | fitted weights and thresholds (`infra/best_meme_strategy.json`) |
| Labeler `[vars]` | `LABELER_LOOKBACK_HOURS`, `LABELER_BATCH_SIZE` | labeling window |
| Pages | `PUBLIC_APP_URL` | canonical URL for metadata |

## Known limitations of the design

- Factors are stored only in `signals`, which is pruned after 72 hours. The trainer joins outcomes to `signals`, so it can only learn from the last 3 days even though outcomes go back to May.
- The volume-burst event compares the raw `fomo` factor with a percentile of stored normalized values: two different scales.
- Tokens that leave the boosted lists stop getting snapshots, so their outcomes are missing. Losers are more likely to leave, which biases the record upward.
- One data source (DexScreener). An outage or an empty list skips minutes.

These are tracked in [ROADMAP.md](ROADMAP.md).
