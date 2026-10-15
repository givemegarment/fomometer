# Tokenomics

Version 0.2, 15 October 2026. **Proposal.** The token is not launched. Swap fees are live; everything else here is the design the token will launch with. Every number marked *proposed* needs the owner's decision, and holder rewards need legal review before they start.

What changed since version 0.1 (14 October 2026) is listed in [section 11](#11-changes-since-version-01).

## 1. Idea in one paragraph

FOMOMETER earns a 1% fee on swaps started from the site. That revenue, the creator fees from trading `$FMTR` itself and any other project revenue go into one pool. Every week part of the pool is paid to `$FMTR` holders in SOL; every day another part buys `$FMTR` on the market and burns it; the rest runs the project. More trading through the site means a bigger pool, a bigger pool means larger rewards and steadier buybacks, and holders have a reason to use the site. The loop only turns while there is revenue; with none, nothing is paid and the report says so.

## 2. The token

| Property | Value |
|---|---|
| Name and ticker | FOMOMETER, `$FMTR` |
| Chain | Solana (SPL token) |
| Launch venue | pump.fun bonding curve |
| Total supply | 1,000,000,000, fixed at launch (pump.fun standard) |
| Mint and freeze authority | revoked by pump.fun at creation; no new tokens can ever be minted |
| Presale, private round, VC allocation | none |
| Team allocation | none, apart from a disclosed launch buy (below) |

**Launch.** The token is created on pump.fun and trades on its bonding curve. When the curve completes, liquidity moves to an AMM pool automatically (PumpSwap at the time of writing; check the current pump.fun rules before launch).

**Launch buy.** The team buys at most 2% of supply (*proposed*) in the creation transaction, from one wallet published in advance, and locks it for 6 months (*proposed*) with a public on-chain lock. No other team or related wallets buy on the curve, and no bundled or sniped buys.

## 3. Where the pool comes from

| Source | Status | Paid in | Arrives in |
|---|---|---|---|
| Swap fees: 1% on swaps started from fomometer.xyz through Jupiter, of which Jupiter keeps 20% | live since 15 October 2026 | the swap's fee token, almost always SOL | Jupiter referral account `Fyhr9NJU2JbwdTL4ZZRRaCpnJH1eLydDnBZsc9khJBTA` |
| pump.fun creator fees from trading `$FMTR` | after launch | SOL | creator wallet, published at launch |
| Other project revenue (Pro, API, data, and any other income) | as it appears | USDC or SOL | treasury, each source on its own report line |

**Pool** = everything received in the epoch, minus on-chain fees and the cost of moving funds. Revenue is counted when it is received, never in advance.

## 4. Where the pool goes

| Share (*proposed*) | Use | When |
|---|---|---|
| 40% | holder rewards, paid in SOL | weekly |
| 40% | buy back `$FMTR` and burn it | daily |
| 20% | operations and research: infrastructure, data, signal research, audits, legal | as needed |

## 5. Holder rewards

| Rule | Value (*proposed*) |
|---|---|
| Epoch | one week, Monday 00:00 UTC |
| Budget | 40% of the previous epoch's pool |
| Paid in | SOL, sent to each eligible wallet |
| Weight | the wallet's average `$FMTR` balance over the epoch, sampled at random times, so buying just before a snapshot earns almost nothing |
| Minimum | an average balance worth $20 or more, converted with the epoch's average price |
| Excluded | liquidity pools, the treasury, team wallets, the burn address, known exchange wallets |
| Dust | a reward below the cost of sending it rolls over to the next epoch |
| Zero pool | no rewards; the report says so |

Every payout transaction is published. Rewards are a share of what the project earned in the past week. They are not interest, not guaranteed, and can be zero.

## 6. Buyback and burn

| Rule | Value (*proposed*) |
|---|---|
| Cadence | every day, in small swaps through Jupiter, at times that are not announced in advance |
| Budget | 40% of the previous epoch's pool, spread evenly over the epoch's days |
| Slippage cap | 1% |
| Destination | every bought token is burned with the SPL burn instruction in the same or the next transaction |
| Treasury | Squads multisig, 2 of 3 signers, addresses published |

Rewards and buybacks never use proceeds from selling `$FMTR`, tokens held by the treasury, or borrowed money.

## 7. What holding unlocks

| Holding (*proposed*) | Access |
|---|---|
| tokens worth $50 or more | Pro, monthly, once Pro exists |
| tokens worth $500 or more | Pro plus API starter plan |

- Ownership is proved by signing a message with the wallet (Sign-In with Solana). No transaction, no approval, no custody.
- Paying for Pro in `$FMTR` burns the whole payment.
- The free site stays fully open without a wallet.

## 8. Conflicts of interest

- `$FMTR` is **excluded from scoring, signals and the board**. The product never ranks its own token.
- The project never trades a token before its signal is public on the site.
- Team wallets are published. Any team sale is announced 7 days in advance with the amount.
- No paid promotion of the token by influencers or callers.
- The track record and the method page stay as they are; revenue does not buy a better-looking record.

## 9. Transparency

A monthly public report, and a `/treasury` page on the site with live on-chain balances:

- pool by source: swap fees, creator fees, other revenue, each on its own line;
- holder rewards per epoch: total SOL, number of wallets, transactions;
- buybacks per day: SOL spent, tokens bought and burned, transactions;
- treasury balances and multisig addresses;
- team wallets and their balances;
- circulating supply after burns.

## 10. How the flywheel could look

An illustration of the mechanics, **not a forecast**. Swap volume today is tiny.

| Assumption | Value |
|---|---|
| Swap volume through the site | $50,000 a week |
| FOMOMETER share of the 1% fee | 80% |
| `$FMTR` trading volume | $200,000 a week |
| Creator fee | 0.05% of volume (check pump.fun's current rate) |

- Swap fees: 50,000 × 1% × 80% = **$400 a week**.
- Creator fees: 200,000 × 0.05% = **$100 a week**.
- Pool $500: **$200** to holders in SOL, **$200** of buybacks and burns, $100 to operations and research.

Whether these amounts matter depends on the token's market cap and trading volume, which nobody controls. Rewards and buybacks do not set a floor price.

## 11. Changes since version 0.1

| Version 0.1 (14 October 2026) | Version 0.2 (15 October 2026) | Why |
|---|---|---|
| No revenue | Swap fees live | A Buy button with a Jupiter referral fee shipped on 15 October |
| Buyback and burn only; "no distribution to holders"; "the token gives no claim on revenue" | 40% of the pool paid to holders in SOL, 40% buyback and burn | Owner decision |
| Creator fees reported separately, kept out of buybacks | Creator fees go into the pool | Owner decision |
| Weekly buyback | Daily buyback | Smaller, steadier market buys |
| Launch after signal research, Pro and paying users | Launch soon, while research continues | Swap fees give revenue before Pro |

Version 0.1 is in the git history of this file.

## 12. Order of launch

1. Legal review of holder rewards in the team's jurisdiction; decide which countries, if any, are excluded.
2. Treasury multisig created, addresses published; `/treasury` page live with swap fees.
3. Token launch on pump.fun.
4. First daily buyback the day after launch; first holder rewards at the end of the first full epoch.
5. First monthly report at the end of the first full month.

## 13. Decisions for the owner

- Pool split (40 / 40 / 20 proposed).
- Reward minimum, epoch, sampling method; exchange wallet list.
- Launch buy size and lock period.
- Pro thresholds and token-payment terms.
- Multisig signers.

## 14. Risks

- The token can lose most or all of its value whatever the product does.
- **Regulation.** Paying holders a share of revenue is a common test for a security, in the United States and elsewhere. Do not start rewards without legal advice; some countries may have to be excluded.
- Revenue can be zero. Swap fees depend on people trading through the site, which depends on traffic and on whether the signals are any good; the public track record shows no edge so far.
- Rewards attract wallets that hold only for the payout and sell after; average-balance weighting reduces this but does not remove it.
- pump.fun and Jupiter rules, fees and programs can change.

Nothing here is an offer to sell or a promise of returns.
