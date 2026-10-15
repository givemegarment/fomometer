# FOMOMETER Whitepaper

Version 0.1, 14 October 2026. Draft for review. Sections 6 and 7 describe plans, not things that exist today.

## 1. Summary

FOMOMETER scores Solana memecoins every minute from public market data and publishes how its past signals actually played out, including when they did badly. It is live at [fomometer.xyz](https://fomometer.xyz), free, with no accounts.

The plan is to keep the core open and free, sell faster and deeper access to people who want it, and tie a community token to that revenue through public, rule-based buybacks. The order matters: measured signal quality first, revenue second, buybacks only from revenue that exists.

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

These numbers are the reason the roadmap starts with signal research, not features.

## 5. Principles

1. **Every call is recorded and scored.** No deleting, no cherry-picking. The track record on the site is computed from all events.
2. **The method is public.** Factors, formula, weights and thresholds are published. The edge, if one is found, has to come from doing the work well, not from secrecy.
3. **No paid placement.** Projects cannot pay to be scored higher, listed, or featured. Revenue comes from users.
4. **No custody.** FOMOMETER never holds user funds or keys and does not trade on users' behalf.
5. **Plain language.** No "AI" claims, no guaranteed returns, no countdowns.

## 6. Business model (planned)

The free site stays free: scanner, signals, token pages, method and track record.

Paid access, priced in USDC or SOL:

| Product | For whom | What it adds |
|---|---|---|
| Pro | active traders | instant alerts (web push and email) on chosen events and tokens, 30-day history, custom filters, CSV export |
| API | bots and dashboards | versioned, rate-limited API with keys, websocket stream of events |
| Data | researchers | daily dumps of factors and outcomes |

Revenue is published monthly. There is no revenue today.

## 7. Token (planned)

A community token, launched fairly on pump.fun, whose demand is linked to the product in two ways: holding it unlocks Pro features, and a fixed share of product revenue buys it back from the market and burns it.

```
  better signals ──► more users ──► Pro and API revenue
        ▲                                   │
        │                     ┌─────────────┴─────────────┐
        │                     ▼                           ▼
        └──────── 50% operations and research    50% buyback and burn
                                                          │
                                                          ▼
  more users ◄── holders unlock Pro ◄────────── fewer tokens in supply
```

The details, rules and safeguards are in [TOKENOMICS.md](TOKENOMICS.md). Key points:

- No presale, no private allocation, no team tokens beyond a disclosed launch buy.
- Buybacks are paid only from realized product revenue, never from token sales or treasury tokens.
- The token gives no ownership, no claim on revenue, no voting rights over the company. Buybacks are a policy, not a promise, and stop if there is no revenue.

## 8. Roadmap

Summary; details in [ROADMAP.md](ROADMAP.md).

1. **Public launch** (done, October 2026): open site, honest method page, stable engine.
2. **Data integrity**: keep factors for every event, count tokens that leave the list, show the baseline next to the track record.
3. **Signal research**: refit on months of data, ship a new score only if it beats the baseline out of sample after costs.
4. **Pro and API**: alerts, history, API keys, payments.
5. **Token**: launch after Pro has paying users, then monthly buyback and burn reports.

## 9. Risks

- **The signal may never work.** Memecoins are close to a lottery with a negative drift. Research can end with "no edge"; the site will say so.
- **Data source.** One upstream (DexScreener). Outages or API changes stop the product.
- **Survivorship.** Tokens that disappear are often the worst performers, and they are missing from the record.
- **Token risk.** A memecoin-style token can lose most or all of its value regardless of the product. Buybacks do not set a floor.
- **Regulation.** A token whose buybacks are funded by a company's revenue may be treated as a security or regulated product in some jurisdictions. Legal review is required before launch.

## 10. Disclaimer

Nothing in this document or on the site is financial advice or an offer to sell anything. Scores and signals are statistics about public market data. Past results do not predict future ones.
