# Tokenomics

Version 0.1, 14 October 2026. **Proposal.** Nothing here exists yet. Every number marked *proposed* needs the owner's decision, and the whole design needs legal review before launch.

## 1. Idea in one paragraph

FOMOMETER sells Pro access and an API. Half of the net revenue buys the token on the open market and burns it, every week, on chain. Holding the token unlocks Pro, and paying for Pro in the token burns all of it. More useful signals bring more paying users, more revenue means more buybacks, a scarcer token makes holding it for Pro more attractive, and holders become users. The loop only turns if the product earns money; the token is a way to share that, not a substitute for it.

## 2. The token

| Property | Value |
|---|---|
| Chain | Solana (SPL token) |
| Launch venue | pump.fun bonding curve |
| Total supply | 1,000,000,000, fixed at launch (pump.fun standard) |
| Mint and freeze authority | revoked by pump.fun at creation; no new tokens can ever be minted |
| Name and ticker | to be decided (*proposed*: FOMOMETER, `$FMTR`) |
| Presale, private round, VC allocation | none |
| Team allocation | none, apart from a disclosed launch buy (below) |

**Launch.** The token is created on pump.fun and trades on its bonding curve. When the curve completes, liquidity moves to an AMM pool automatically (PumpSwap at the time of writing; check the current pump.fun rules before launch).

**Launch buy.** The team buys at most 2% of supply (*proposed*) in the creation transaction, from one wallet published in advance, and locks it for 6 months (*proposed*) with a public on-chain lock. No other team or related wallets buy on the curve, and no bundled or sniped buys.

## 3. Where revenue comes from

| Source | Paid in | Counts as product revenue |
|---|---|---|
| Pro subscriptions | USDC, SOL, or the token | yes |
| API plans | USDC, SOL | yes |
| Data dumps | USDC, SOL | yes |
| pump.fun creator fees on token trading | SOL | **no**, reported separately |

Creator fees come from people trading the token, not from the product. Counting them as revenue would make the loop feed itself, so they are reported on their own line and go to operations, not to buybacks.

**Net revenue** = product revenue minus payment processing and on-chain fees, minus infrastructure and data costs directly needed to serve paying users.

## 4. Where revenue goes

| Share of net revenue | Use |
|---|---|
| 50% (*proposed*) | buy back and burn the token |
| 30% (*proposed*) | operations: infrastructure, data, support |
| 20% (*proposed*) | research reserve: signal research, audits, legal |

Pro payments made **in the token** are burned in full and do not pass through this split.

There is no staking, no yield, no airdrop of revenue and no distribution to holders. Value reaches holders only through supply going down and through what holding unlocks.

## 5. Buyback and burn

| Rule | Value |
|---|---|
| Epoch | one week, Monday 00:00 UTC (*proposed*) |
| Budget | 50% of the previous epoch's net revenue, received in USDC or SOL |
| Execution | spread over 24 hours in small swaps through an aggregator (Jupiter), slippage cap 1% (*proposed*), at times that are not announced in advance to avoid front-running |
| Destination | every bought token is burned with the SPL burn instruction in the same or the next transaction |
| Treasury | Squads multisig, 2 of 3 signers, addresses published |
| Zero revenue | zero buyback; the report says so |

Buybacks never use proceeds from selling the token, tokens held by the treasury, or borrowed money.

## 6. What holding unlocks

| Holding (*proposed*) | Access |
|---|---|
| tokens worth $50 or more | Pro, monthly |
| tokens worth $500 or more | Pro plus API starter plan |

- Ownership is proved by signing a message with the wallet (Sign-In with Solana). No transaction, no approval, no custody.
- The threshold is in dollars and converted to a token amount once a month from the 7-day average price, so access does not flip with every price swing.
- Balance is re-checked daily. Selling below the threshold ends holder access at the next check.
- The free site stays fully open without a wallet.

## 7. Conflicts of interest

- The FOMOMETER token is **excluded from scoring, signals and the scanner**. The product never ranks its own token.
- Team wallets are published. Any team sale is announced 7 days in advance with the amount.
- No paid promotion of the token by influencers or callers.
- The track record and the method page stay as they are; the token does not buy a better-looking record.

## 8. Transparency

A monthly public report, also linked from a `/treasury` page on the site:

- product revenue by source, costs, net revenue;
- creator fees received and how they were spent;
- buyback amount per epoch, tokens bought, tokens burned, transaction signatures;
- treasury balances and multisig addresses;
- team wallets and their balances;
- circulating supply after burns.

## 9. How the loop could look

An illustration of the mechanics, **not a forecast**. There are no paying users today.

| Assumption | Value |
|---|---|
| Pro users paying in USDC | 200 at $29 a month |
| Pro users paying in the token | 50 at $23 (20% discount) |
| API plans | 10 at $99 a month |
| Payment and infrastructure costs | $600 a month |

- Product revenue in USDC: 200 × 29 + 10 × 99 = $6,790; net $6,190.
- Buyback and burn: 50% = **$3,095 a month**, about $715 a week.
- Burned from token payments: 50 × 23 = **$1,150 a month** of tokens.
- Operations: $1,857, research: $1,238.

Whether these burns matter depends on the token's market cap and trading volume, which nobody controls. Buybacks do not set a floor price.

## 10. Order of launch

1. Signal research shows the score beats the baseline (see [ROADMAP.md](ROADMAP.md)), or the site says plainly that it does not.
2. Pro and API go live with USDC and SOL payments; first paying users.
3. Legal review of the token design in the team's jurisdiction.
4. Token launch on pump.fun, holder access switched on, `/treasury` page live.
5. First buyback at the end of the first full epoch after launch.

Launching the token before step 2 is possible but means months of zero buybacks, and a token with no revenue behind it is just a memecoin.

## 11. Decisions for the owner

- Name and ticker.
- Launch timing relative to Pro (step order above).
- Launch buy size and lock period.
- Revenue split (50 / 30 / 20 proposed).
- Pro price, holder thresholds, token-payment discount.
- Multisig signers.

## 12. Risks

- The token can lose most or all of its value whatever the product does.
- Buybacks funded by company revenue may make the token a security or another regulated product in some jurisdictions, including the United States. Do not launch without legal advice.
- Holding-for-access ties product access to a volatile asset; users may lose money just to keep Pro.
- pump.fun rules, fees and migration targets can change.

Nothing here is an offer to sell or a promise of returns.
