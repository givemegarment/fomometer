# How FOMOMETER works

<!-- Generated from apps/web/messages/en.json (method.*, factors.*), the same text as /how-it-works. Edit the JSON, then regenerate. -->

FOMOMETER is a scoring tool for Solana memecoins. It does not use a neural network or a language model: the score is a transparent formula over public market data. This page describes exactly what it does and where it falls short.

## Data

Every minute the engine reads DexScreener's boosted-token lists (top and latest boosts) and keeps the Solana tokens, up to 50. Boosts are paid promotion, so this is a list of promoted tokens, not of the most popular ones. For each token it records price, liquidity, fully diluted value, volume and buy/sell counts. Snapshots are kept for 72 hours.

## The 12 factors

From the last 90 minutes of snapshots the engine computes 12 factors per token. Each factor is then standardized against all tokens in the same minute (a z-score capped at ±5), so a value says how unusual a token is compared with the rest of the list right now.

| Factor | Key | What it measures | In the score |
|---|---|---|---|
| 1-minute return | `ret` | Log price change since the previous snapshot, about one minute. | No, context only |
| Liquidity depth | `liq_score` | Liquidity relative to fully diluted value, scaled to 0..1. Higher means a position is easier to exit. | Yes |
| Buy pressure | `pressure` | Balance of buy and sell transactions over the last hour, from -1 (only sells) to +1 (only buys). | Yes |
| Volume burst | `fomo` | Volume of the last 5 minutes compared with the pace of the last hour. Shows a sudden rush of trading. | Yes |
| Deviation from average | `dev` | How far the price is from its average over the last 20 snapshots. | Yes |
| Volume size | `log_vol` | Logarithm of 1-hour trading volume. | No, context only |
| Volatility | `vol_cluster` | Spread of 1-minute returns over the last 10 snapshots. | No, context only |
| Reversal | `momentum_rev` | 1 when the last 5-minute move goes against the 5 minutes before it, otherwise 0. | Yes |
| RSI | `rel_strength` | Relative strength index over 14 one-minute returns, rescaled to -1..1. | Yes |
| 1-hour move | `hl_range` | Size of the 1-hour price change reported by DexScreener, in either direction. | No, context only |
| Range position | `close_pos` | Where the current price sits between the low and the high of the last 60 snapshots, 0..1. | No, context only |
| Volume trend | `vol_trend` | 1-hour volume compared with the hourly average over the last 6 hours. | Yes |

## The score

The score is a weighted sum of 7 factors passed through a sigmoid, shown on the site as 0 to 100. The 7 factors are volume burst, buy pressure, reversal, liquidity depth, volume trend, RSI and deviation from average. The weights were fitted on past signals with a walk-forward random search. The other 5 factors are shown for context and do not change the score. The current weights are on the Strategy page.

The engine also labels the market as neutral, bull, bear or panic from the spread of scores and volume trends across the list, and shifts the weights for volume burst, buy pressure and liquidity accordingly. The current regime is on the Strategy page.

## Signals

Signals are events recorded when a token's score or volume crosses a threshold. They describe what happened in the data; they are not instructions to trade.

- **BUY**: The score rises from below the BUY threshold to at or above it.
- **SELL**: The score falls from at or above the BUY threshold to at or below the SELL threshold in one step. This is rare by design.
- **Volume burst**: The raw volume-burst factor exceeds its threshold: the 95th percentile of the last 6 hours, and never below 1.5. At most one per token every 30 minutes.

Thresholds are either fitted together with the weights or derived from recent score percentiles. Current values are on the Strategy page.

## Quality filter

A token can trigger signals only if FOMOMETER first saw it at least 48 hours ago, it has at least 10 snapshots, at least $25,000 of liquidity, a buy/sell ratio between 0.8 and 3.0 over the last hour, and has not risen between 50% and 100% in the last hour. The 48-hour rule was fitted on May to August outcomes and checked on September and October: it roughly halved the median 4-hour loss after BUY, but BUY stayed negative after trading costs. Tokens that fail are still scored and shown, they just cannot trigger signals.

## Track record

15 minutes, 1 hour and 4 hours after each signal the price change is recorded. The Strategy page shows how often the price moved in the signal's direction (up after BUY and volume burst, down after SELL) and the median change. Medians are used because a few extreme moves would dominate an average. Percentages are hidden when there are fewer than 20 outcomes.

## Limitations

The track record has no fees and no slippage, and entry is the snapshot price. Since 15 October 2026 the engine keeps pricing a token for 4 hours after it leaves the list; before that, tokens that disappeared (often after a collapse) had no later price and dropped out, which flatters older results. The Strategy page shows how many outcomes still have no price, leaves out prices that jump more than 11 times (a switch to another pool), and compares every signal with all tracked tokens priced the same way. Samples are small and markets change, so past results say little about future ones. Scoring runs can fail or lag; the LIVE / STALE badge shows how fresh the data is. Nothing on this site is financial advice.

## Source code

- Factors: `packages/shared/src/engine/factors.ts`
- Score and regimes: `packages/shared/src/engine/score.ts`
- Signals, thresholds, quality filter: `workers/engine/src/index.ts`
- Outcomes: `workers/labeler/src/index.ts`
- Track record aggregation: `apps/web/app/api/strategy/route.ts`
