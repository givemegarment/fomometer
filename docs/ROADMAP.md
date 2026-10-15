# Roadmap

Updated 15 October 2026. Phases can overlap; each one is done when it meets its exit criteria, not on a date. Signal research waits for 30 days of stored data, so swaps and the token move ahead in the meantime. The previous roadmap (May 2026, Telegram-gated product) is in [archive/ROADMAP-2026-05.md](archive/ROADMAP-2026-05.md).

## Phase 1. Public launch (done)

- [x] Site open to everyone, Telegram login and links removed.
- [x] Honest positioning, method page `/how-it-works`, repository documentation.
- [x] Data fixes: freshness, logos, price charts, event types, direction-aware track record.
- [x] Engine fits the free CPU limit (was failing every run); scores written every minute.
- [x] Labeler takes prices only within 10 minutes of each horizon.
- [x] Current weights and thresholds on the Strategy page.
- [x] Legacy `fomometer-recheck` worker and unused Pages secrets removed.

## Phase 2. Data integrity (in progress)

Goal: a track record nobody can call flattering.

- [x] Store the 12 factors with every event (`signal_events.metadata_json` or a new column), so training can use all history instead of the last 72 hours.
- [x] Keep tracking a token for 4 hours after an event even if it leaves the boosted lists, so its outcome is not lost.
- [x] Count an event whose token has no later price as a separate "lost" outcome and show the share on the Strategy page.
- [x] Show the baseline (all tracked tokens, same window) next to the track record.
- [x] Fix the volume-burst threshold scale (raw value compared with a percentile of normalized values).
- [x] Mark or exclude outcomes with impossible prices (moves of thousands of percent).
- [x] Delete legacy tables `users`, `sessions`, `watchlist` and unused KV namespaces `SESSIONS` and `CACHE` (15 October 2026).
- [x] Delete the old Telegram bot (15 October 2026).
- [x] Serve token logos through the site to drop DexScreener's third-party cookie (`/api/logo`).
- [x] Update `research/README_walk_forward.md` (mentions removed routes and old warm-up).

Exit: Strategy page shows baseline, lost outcomes and a cleaned record; factors stored for every event for 30 days.

## Phase 3. Swaps and treasury (in progress)

Goal: revenue that anyone can check on chain.

- [x] Buy button on token pages and fresh BUY signals: Jupiter Plugin swap in the visitor's wallet, 1% referral fee (`apps/web/lib/trade.ts`).
- [x] Referral account `Fyhr9NJU2JbwdTL4ZZRRaCpnJH1eLydDnBZsc9khJBTA` (Jupiter Ultra) with SOL, USDC and USDT fee accounts; first fee received on chain, 15 October 2026.
- [ ] Record every swap with the signal it followed (`onSuccess` → API → D1, verified against the transaction on chain).
- [ ] `/treasury` page with live on-chain balances of the fee accounts.
- [ ] Sell button and preset amounts.

Exit: treasury page live and every swap recorded with its signal.

## Phase 4. `$FMTR` launch

Goal: a community token that shares revenue with its holders. Design in [TOKENOMICS.md](TOKENOMICS.md).

- [ ] Legal review of holder rewards; decide excluded countries.
- [ ] Owner decisions: pool split, reward minimum, launch buy, multisig signers.
- [ ] Treasury multisig, addresses published.
- [ ] Fair launch on pump.fun; `$FMTR` excluded from its own board and signals.
- [ ] Weekly holder rewards in SOL.
- [ ] Daily buyback and burn.
- [ ] Monthly report: pool by source, rewards, burns, transactions.

Exit: three consecutive monthly reports published.

## Phase 5. Signal research

Goal: a score that beats picking at random, or a public statement that it does not.

- [ ] Refit weights and thresholds on 30+ days of stored factors with a proper walk-forward split and a cost model (fees, slippage).
- [ ] Test alternative targets: drawdown risk ("avoid" signals) may be more predictable than upside.
- [ ] Test whether the BUY event should be inverted, narrowed, or dropped; current data shows it picks short-lived momentum.
- [ ] Publish a model card for each shipped strategy: training window, test metrics, baseline, date.
- [ ] Ship a new strategy only if it beats the baseline on the test split after costs.

Exit: one shipped strategy with a published model card, or a published negative result and the product repositioned as analytics only.

## Phase 6. Pro and API

Goal: paid access for people who want more than the free site.

- [ ] Alerts by web push and email on chosen events and tokens.
- [ ] 30-day history and CSV export.
- [ ] Versioned public API with keys, rate limits and an event stream.
- [ ] Payments in USDC and SOL, no custody.
- [ ] Terms of service and privacy policy.
- [ ] Pay for Pro in `$FMTR`, or hold it for access.

Exit: paying users for two consecutive months.

## Later, not committed

- More chains (Base, BNB) with the same method.
- More data sources than DexScreener.
- A public research notebook with the dataset.
