# Roadmap

Updated 14 October 2026. Phases run in order; a phase starts when the previous one's exit criteria are met, not on a date. The previous roadmap (May 2026, Telegram-gated product) is in [archive/ROADMAP-2026-05.md](archive/ROADMAP-2026-05.md).

## Phase 1. Public launch (done)

- [x] Site open to everyone, Telegram login and links removed.
- [x] Honest positioning, method page `/how-it-works`, repository documentation.
- [x] Data fixes: freshness, logos, price charts, event types, direction-aware track record.
- [x] Engine fits the free CPU limit (was failing every run); scores written every minute.
- [x] Labeler takes prices only within 10 minutes of each horizon.
- [x] Current weights and thresholds on the Strategy page.
- [x] Legacy `fomometer-recheck` worker and unused Pages secrets removed.

## Phase 2. Data integrity

Goal: a track record nobody can call flattering.

- [ ] Store the 12 factors with every event (`signal_events.metadata_json` or a new column), so training can use all history instead of the last 72 hours.
- [ ] Keep tracking a token for 4 hours after an event even if it leaves the boosted lists, so its outcome is not lost.
- [ ] Count an event whose token has no later price as a separate "lost" outcome and show the share on the Strategy page.
- [ ] Show the baseline (all tracked tokens, same window) next to the track record.
- [ ] Fix the volume-burst threshold scale (raw value compared with a percentile of normalized values).
- [ ] Mark or exclude outcomes with impossible prices (moves of thousands of percent).
- [ ] Delete legacy tables `users`, `sessions`, `watchlist` (3 stored Telegram identities); remove the Telegram bot webhook; delete unused KV namespaces `SESSIONS` and `CACHE`.
- [ ] Serve token logos through the site to drop DexScreener's third-party cookie.
- [ ] Update `research/README_walk_forward.md` (mentions removed routes and old warm-up).

Exit: Strategy page shows baseline, lost outcomes and a cleaned record; factors stored for every event for 30 days.

## Phase 3. Signal research

Goal: a score that beats picking at random, or a public statement that it does not.

- [ ] Refit weights and thresholds on 30+ days of stored factors with a proper walk-forward split and a cost model (fees, slippage).
- [ ] Test alternative targets: drawdown risk ("avoid" signals) may be more predictable than upside.
- [ ] Test whether the BUY event should be inverted, narrowed, or dropped; current data shows it picks short-lived momentum.
- [ ] Publish a model card for each shipped strategy: training window, test metrics, baseline, date.
- [ ] Ship a new strategy only if it beats the baseline on the test split after costs.

Exit: one shipped strategy with a published model card, or a published negative result and the product repositioned as analytics only.

## Phase 4. Pro and API

Goal: first revenue.

- [ ] Alerts by web push and email on chosen events and tokens.
- [ ] 30-day history and CSV export.
- [ ] Versioned public API with keys, rate limits and an event stream.
- [ ] Payments in USDC and SOL, no custody.
- [ ] Terms of service and privacy policy.
- [ ] Monthly public revenue report.

Exit: paying users for two consecutive months.

## Phase 5. Token

Goal: tie the product's revenue to a community token. Design in [TOKENOMICS.md](TOKENOMICS.md).

- [ ] Legal review.
- [ ] Owner decisions: name, ticker, launch buy, split, thresholds.
- [ ] Treasury multisig, `/treasury` page, report template.
- [ ] Fair launch on pump.fun; FOMOMETER token excluded from its own scanner.
- [ ] Holder access via wallet signature.
- [ ] Weekly buyback and burn, monthly report.

Exit: three consecutive monthly reports published.

## Later, not committed

- More chains (Base, BNB) with the same method.
- More data sources than DexScreener.
- A public research notebook with the dataset.
