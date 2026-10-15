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

## Swaps

Buying runs entirely in the browser and on Jupiter; no FOMOMETER server is involved.

| Part | Where | What it does |
|---|---|---|
| Settings | `apps/web/lib/trade.ts` | referral account, fee in basis points (100 = 1%), SOL mint; an empty account hides every Buy button |
| Button | `apps/web/components/trade/buy-button.tsx` | on the first click loads `https://plugin.jup.ag/plugin-v1.js`, then opens its modal with SOL in, the token out and the referral fee |
| Placement | token page (not below the liquidity filter), Signals (BUY events younger than 1 hour) | |
| Fee | Jupiter Ultra `/order` with `referralAccount` and `referralFee`; Jupiter keeps 20% of it | lands in the referral account's token account for the fee mint, almost always SOL |

The visitor connects and signs in their own wallet. A referral account that is not initialized under Jupiter's Ultra project makes `/order` fail with 400, so a wrong address breaks buying, not only the fee. A missing token account for the fee mint only drops the fee.

## Engine cycle

One run per minute, inside the Workers free-plan CPU limit (50 ms). Measured after the October 2026 rewrite: 15 to 57 ms CPU, 1.4 to 3.7 s wall time, mostly waiting on DexScreener and D1.

1. **Universe.** Token-boost lists (top and latest), Solana only, up to `ENGINE_TOP_N` (50). An empty response skips the minute. Tokens scored in the last 4 h 10 m that are no longer boosted are added for snapshots only (up to 60, `last_run.tracked_after_list`; the list is `engine_state.last_scored`): they get a price but no score, so neither event outcomes nor baseline samples lose their price when a token leaves.
2. **Snapshots.** Pair data for each token: price, liquidity, FDV, volumes (5m, 1h, 6h, 24h), price changes, buy and sell counts. Written to `token_snapshots`. Token metadata goes to `tokens`; an empty logo from DexScreener does not overwrite a stored one.
3. **Factors.** One query loads the last 90 minutes of snapshots for every token (`json_each`). `packages/shared/src/engine/factors.ts` computes 12 factors.
4. **Normalization.** Each factor is z-scored across the tokens of this minute and capped at ±5 (`ENGINE_CROSS_SECTIONAL_NORM`).
5. **Score.** A sigmoid of a weighted sum of 7 normalized factors (`score.ts`). Weights and thresholds come from the `STRATEGY_FORMULA_JSON` secret, otherwise from defaults. A market regime (neutral, bull, bear, panic) shifts three of the weights (`ENGINE_REGIME_AWARE`).
6. **Events.** BUY when the score crosses the BUY threshold upward, SELL when it drops from above BUY to below SELL in one step, volume burst when the raw `fomo` factor beats the 95th percentile of the same raw factor over the last 6 hours (`signals.fomo_raw`, floor 1.5, once per token per 30 minutes). Only tokens that pass the quality filter (10 snapshots, $25k liquidity, buy/sell ratio 0.8 to 3.0, not up 50 to 100% in the hour) can emit events.
7. **Writes.** All `signals` and `signal_events` rows go in one `DB.batch`. Each event's `metadata_json` holds the regime, the threshold and both factor vectors (`factors.scored`, `factors.raw`). The run summary goes to `engine_state.last_run`; the burst threshold is cached in `engine_state.fomo_th_raw` for 30 minutes.
8. **Retention.** Snapshots and signals older than 72 hours are deleted, events older than 72 hours plus 14 days.

## Labeler

Every 15 minutes it takes events without an outcome whose 4-hour horizon has passed (events 4 h 10 m to 16 hours old, so every snapshot inside the 10-minute tolerance already exists; `LABELER_LOOKBACK_HOURS` = 12), finds the first snapshot at or after 15 minutes, 1 hour and 4 hours (accepted only within 10 minutes of the horizon), and writes `signal_outcomes` with the price changes, the best and worst move inside 4 hours, the event's factor vectors (`factors_json`) and `price_flag`. `price_flag = 'rise_over_1000pct'` marks a best price more than 11× entry inside the window, which on DexScreener is almost always a switch to a different pool (441 of 45,759 outcomes on 2026-10-15). Outcomes are never pruned; they are the long-term record (from 2026-05-06).

The same run fills `baseline_outcomes`: every token scored in the first engine run of each 30-minute slot, priced at 1 h and 4 h with the same tolerance, plus the best price in 4 h. This is the "pick at random from the same list" comparison for the track record. Up to 8 slots per run; the cursor is `engine_state.baseline_cursor`.

## Data model

Schema: `infra/d1-schema.sql`. Times are Unix seconds.

| Table | Rows (2026-10-14) | Kept | Purpose |
|---|---|---|---|
| `tokens` | 11,653 | forever | symbol, name, logo, pair |
| `token_snapshots` | ~133k | 72 h | one row per token per minute |
| `signals` | ~15k | 72 h | score, all 12 normalized factors (`factors_json`) and the raw burst factor (`fomo_raw`) per token per minute |
| `signal_events` | ~4.4k | 72 h + 14 d | BUY, SELL, volume burst, with factors in `metadata_json` |
| `signal_outcomes` | 45,759 | forever | price after 15m / 1h / 4h per event, factors (since 2026-10-15), `price_flag` |
| `baseline_outcomes` | | forever | every scored token every 30 min, price after 1h / 4h (since 2026-10-15) |
| `engine_state` | 6 | | `last_run`, `fomo_th_raw`, `last_scored`, `baseline_cursor`, `track_record` (7-day summary for the Strategy page, refreshed hourly by the labeler) |

## JSON API

All routes are `GET`, edge runtime, read-only, no authentication. Prices in USD, scores 0..1 (the site shows them ×100).

| Route | Parameters | Returns |
|---|---|---|
| `/api/status` | | `snapshot_at`, `scored_at`: newest price and score times. LIVE on the site when prices are under 3 minutes old. |
| `/api/scanner` | `filter=score\|liq\|fomo`, `limit` 10..50 | `rows`: tracked tokens (scored within 10 minutes of the newest score; price from the latest snapshot) with price, liquidity, score, factors, logo, `scored_at` |
| `/api/overview` | | `buy_signals_1h` (BUY events in the last hour, for the board) |
| `/api/logo/<id>` | `s=64\|128\|256` | token logo from DexScreener's CDN as webp, without its cookie, cached for a week |
| `/api/signals` | `type=buy\|sell\|fomo`, `limit` 20..200 | `events` with token symbol and logo |
| `/api/tokens/{address}` | | `token`, `history` (6 h of price and score), latest factors, recent events |
| `/api/strategy` | | `settings` from `last_run` (thresholds, regime, weights) and `record` from `track_record`: last 7 days per event type and for the all-tokens baseline, per horizon n, share favorable, median change, plus flagged and no-price-at-4h counts |
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

- Outcomes before 2026-10-15 have no stored factors; for them the trainer can only use the last 72 hours of `signals`.
- Baseline samples start on 2026-10-15 (the first run reaches back 68 hours); comparisons over longer windows only cover that span.
- Before 2026-10-15 tokens that left the boosted lists stopped getting snapshots: about 40 % of those outcomes have no 4-hour price. Losers are more likely to leave, which biases that part of the record upward.
- `price_flag` is a single rule (best price above 11× entry). A pool switch that lowers the price, or one smaller than 11×, is not caught.
- One data source (DexScreener). An outage or an empty list skips minutes.

These are tracked in [ROADMAP.md](ROADMAP.md).
