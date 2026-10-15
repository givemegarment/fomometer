# FOMOMETER Whitepaper

Version 0.2, 15 October 2026. Swap fees are live; the `$FMTR` token is not launched yet, so section 7 describes the rules it will launch with. What changed since version 0.1 is in section 7.4.

## 1. Summary

FOMOMETER scores Solana memecoins every minute from public market data and publishes how its past signals actually played out, including when they did badly. It is live at [fomometer.xyz](https://fomometer.xyz), free, with no accounts.

Since 15 October 2026 it also earns. A Buy button opens a Jupiter swap in the visitor's own wallet, and each swap includes a 1% FOMOMETER fee. The `$FMTR` token will route that revenue back to holders: part paid out in SOL every week, part spent buying the token back and burning it. Revenue does not make the signals better than they are; the track record below stays the measure of that.

## 2. The problem

Memecoin traders choose from thousands of new tokens a day. The tools they use fall into two groups. Raw data terminals (DexScreener, Birdeye) show everything and rank nothing. Signal bots and "AI callers" rank everything and show no record: their calls are screenshots of winners, never a full list with losers.

What is missing is a ranking whose method is public and whose every call is measured afterwards, so a user can see how much to trust it.

## 3. What FOMOMETER does

Every minute:

1. Reads DexScreener's boosted-token lists and keeps the Solana tokens, up to 50.
2. Computes 12 market factors per token from the last 90 minutes: volume burst, buy pressure, liquidity depth, reversal, RSI, volume trend, deviation from average and five context factors.
3. Standardizes each factor against the other tokens in the same minute, so a value means "unusual compared with the rest of the list right now".
4. Combines 7 of them into a 0 to 100 score: a weighted sum through a sigmoid. Weights and thresholds are fitted on past outcomes with walk-forward random search. The current weights are published on the Strategy page.
5. Records BUY, SELL and volume-burst events when thresholds are crossed, with a quality filter (minimum history, $25k liquidity, sane buy/sell ratio, no tokens already up 50 to 100% in the hour).
6. Records the price 15 minutes, 1 hour and 4 hours after every event.

No neural network or language model is involved. The full method is in [METHODOLOGY.md](METHODOLOGY.md) and on the site at `/how-it-works`; the system design is in [ARCHITECTURE.md](ARCHITECTURE.md).

## 4. Evidence so far

Since 6 May 2026 the labeler has recorded the outcome of 45,618 events (all queries run on 14 October 2026). "Favorable" means the price was higher afterwards (lower for SELL). Medians, because a few broken prices produce averages of thousands of percent.

| Event | With outcome | After 1 h: favorable | After 1 h: median | After 4 h: favorable | After 4 h: median |
|---|---|---|---|---|---|
| BUY | 26,200 | 41.6% | −0.92% | 37.4% | −4.37% |
| Volume burst | 19,401 | 39.2% | −0.66% | 37.9% | −2.44% |
| SELL | 17 | too few | | | |

Within 4 hours after a BUY, the worst point was a fall of 11% in the median case, and 16% of BUY tokens fell by half or more at some point.

To tell whether this is better than picking at random, compare with all tracked tokens over the same 72 hours (one sample every 10 minutes per token):

| Last 72 hours | After 1 h: higher | After 1 h: median | After 4 h: higher | After 4 h: median |
|---|---|---|---|---|
| Any tracked token (baseline) | 33.1% | 0.00% | 36.3% | −1.15% |
| BUY events | 40.7% | −0.86% | 29.7% | −8.97% |
| Volume-burst events | 38.5% | −0.61% | 39.1% | −2.24% |

**What this says.** The boosted-token universe loses value on average: most promoted memecoins drift down. BUY events pick tokens that are more often up an hour later than a random tracked token, but their median move is worse, and after 4 hours they do clearly worse than the baseline. The current score finds momentum that tends to reverse. It does not have a demonstrated trading edge, and nothing on the site claims one.

**Caveats.** No fees or slippage. Tokens that leave the list have no later price and are left out, which flatters every row above. Outcomes before 14 October 2026 could use a price taken later than the horizon when a token had gaps. The current weights were fitted on 7 May 2026 and the engine has changed several times since, so the all-time table mixes versions.

These numbers are why signal research stays on the roadmap and why the site claims no edge.

## 5. Principles

1. **Every call is recorded and scored.** No deleting, no cherry-picking. The track record on the site is computed from all events.
2. **The method is public.** Factors, formula, weights and thresholds are published. The edge, if one is found, has to come from doing the work well, not from secrecy.
3. **No paid placement.** Projects cannot pay to be scored higher, listed, or featured. Revenue comes from users.
4. **No custody.** FOMOMETER never holds user funds or keys and does not trade on users' behalf. Swaps run in the user's own wallet.
5. **No trading ahead of signals.** The project never trades a token before its signal is public on the site.
6. **Plain language.** No "AI" claims, no guaranteed returns, no countdowns.

## 6. Business model

The free site stays free: board, signals, token pages, method and track record.

| Product | Status | For whom | What it adds |
|---|---|---|---|
| Swaps | live since 15 October 2026 | anyone buying a token | a Buy button that opens a Jupiter swap in the user's own wallet; 1% FOMOMETER fee, of which Jupiter keeps 20% |
| Pro | planned | active traders | instant alerts (web push and email) on chosen events and tokens, 30-day history, custom filters, CSV export |
| API | planned | bots and dashboards | versioned, rate-limited API with keys, websocket stream of events |
| Data | planned | researchers | daily dumps of factors and outcomes |

Every source of revenue is published monthly on its own line, with the on-chain account it arrives in.

## 7. Token: `$FMTR` (not launched)

A community token, launched fairly on pump.fun. Revenue goes into one pool; part is paid to holders, part buys the token back and burns it, and the rest runs the project.

### 7.1 The flywheel

```
  swaps through the site ──► 1% fee ──┐
  trading $FMTR ──► creator fees ─────┼──► pool ──┬──► 40% holder rewards, SOL, weekly
  other project revenue ──────────────┘           ├──► 40% buy $FMTR and burn, daily
                                                  └──► 20% operations and research
        ▲                                                            │
        └──── holders use the site, research improves the signals ◄──┘
```

### 7.2 Proposed parameters

| | |
|---|---|
| Supply | 1,000,000,000, fixed; minting disabled at creation |
| Launch | fair launch on pump.fun; no presale, no private round |
| Team | one disclosed launch buy of at most 2%, locked for 6 months |
| Pool split | 40% holder rewards, 40% buyback and burn, 20% operations and research |
| Holder rewards | weekly, in SOL, pro rata to each wallet's average balance over the week; minimum tokens worth $20; pools, treasury, team and burn addresses excluded |
| Buyback | daily, small swaps through Jupiter, from a 2-of-3 multisig; bought tokens burned on chain |
| Own token | excluded from FOMOMETER's board and signals |

Full design and safeguards: [TOKENOMICS.md](TOKENOMICS.md).

### 7.3 Rules

- Rewards and buybacks are paid only from revenue already received, never from token sales, treasury tokens or borrowed money.
- No revenue means no rewards and no buyback, and the report says so.
- Every payment in, every reward and every burn is published with its transaction.
- A change to these rules is announced 14 days ahead in a new version of this paper.

### 7.4 Changed since version 0.1

- Swap fees exist; version 0.1 had no revenue.
- Holders receive part of the revenue in SOL. Version 0.1 had buyback and burn only and said the token gives no claim on revenue.
- Creator fees from trading `$FMTR` go into the pool; version 0.1 kept them out of buybacks.
- Buybacks run daily instead of weekly.
- The token no longer waits for Pro and for the signal research to finish.

## 8. Roadmap

Summary; details in [ROADMAP.md](ROADMAP.md).

1. **Public launch** (done, October 2026): open site, honest method page, stable engine.
2. **Data integrity** (in progress): factors stored for every event, lost outcomes counted, baseline next to the track record; done once 30 days of factors are stored.
3. **Swaps and treasury** (in progress): Buy button with a 1% fee (live), swaps recorded per signal, public treasury page.
4. **`$FMTR` launch**: legal review, multisig, fair launch, weekly rewards, daily buyback and burn, monthly reports.
5. **Signal research**: refit on 30+ days of data; ship a new score only if it beats the baseline out of sample after costs.
6. **Pro and API**: alerts, history, API keys, payments.

## 9. Risks

- **The signal may never work.** Memecoins are close to a lottery with a negative drift. Research can end with "no edge"; the site will say so. Swap revenue does not depend on the signals being good.
- **Revenue can be zero.** Rewards and buybacks are a share of what the project earns; a quiet week means small or no payouts.
- **Data source.** One upstream (DexScreener). Outages or API changes stop the product.
- **Survivorship.** Tokens that disappear are often the worst performers, and they are missing from the record.
- **Token risk.** A memecoin-style token can lose most or all of its value regardless of the product. Rewards and buybacks do not set a floor.
- **Regulation.** Paying holders a share of revenue is a common test for a security, in the United States and elsewhere. Legal advice comes before rewards start, and some countries may be excluded.

## 10. Disclaimer

Nothing in this document or on the site is financial advice, an offer to sell anything or a promise of returns. Scores and signals are statistics about public market data. Past results do not predict future ones.
