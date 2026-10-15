# Operations

How to deploy, check and repair FOMOMETER. Setup from scratch is in [infra/cloudflare-setup.md](../infra/cloudflare-setup.md).

All commands run from the repository root after exporting the root `.env` (wrangler does not read it from inside the packages):

```bash
set -a; . ./.env; set +a
```

## Deploy

| What | Command | Notes |
|---|---|---|
| Site | `pnpm deploy:web` | next-on-pages build, then Pages deploy. Prints a `*.fomometer-web.pages.dev` preview URL; production domains update at the same time. |
| Engine | `pnpm deploy:engine` | Takes effect on the next minute. |
| Labeler | `pnpm deploy:labeler` | |
| Schema | `pnpm d1:apply:remote` | Idempotent (`IF NOT EXISTS`). Creates missing tables only; it does not add columns to existing ones. |
| Migration | `npx wrangler d1 execute fomometer --remote --file=./infra/migrations/<file>.sql` | Column changes for an existing database. Run each file once, before deploying the workers that use it. |

Before a deploy: `pnpm typecheck`, `pnpm test` (vitest: scoring math, track record statistics, price and logo formatting), `pnpm -F @fomometer/web lint`, `pnpm -F @fomometer/web build`.

## Health checks

Automatic: `.github/workflows/health.yml` checks `/api/status` every 15 minutes and fails when scores are more than 10 minutes old. GitHub emails failed scheduled runs to the repository owner.

| Check | How | Healthy |
|---|---|---|
| Data freshness | `curl https://fomometer.xyz/api/status` | `snapshot_at` and `scored_at` within 2 minutes of now and equal to each other |
| Engine runs | `cd workers/engine && npx wrangler tail fomometer-engine --format json` | every run `"outcome":"ok"`, log line `engine cycle: N tokens …` |
| Scanner | `curl https://fomometer.xyz/api/scanner` | 20 to 50 rows |
| Labeler | `SELECT MAX(labeled_at) FROM signal_outcomes` | within 30 minutes |

D1 queries: `npx wrangler d1 execute fomometer --remote --command "…"` (run inside `workers/engine` so the binding resolves).

## Incidents

**STALE badge, `scored_at` behind `snapshot_at`.** The engine stores prices but dies before scoring. Run `wrangler tail`. `exceededCpu` means the run went over the 50 ms CPU limit of the free plan: look for a new per-minute query that pulls many rows or parses JSON in the worker. This is what happened before October 2026 (the burst percentile parsed ~9,000 rows a minute).

**STALE badge, both times behind.** The engine is not running or DexScreener returns nothing. Tail logs: `boosts unavailable (… HTTP 429 …), using the list from Ns ago` is a short DexScreener outage covered by the last good list; `no universe (…), skipping` means it has lasted over 10 minutes; no logs at all means the cron is off (Workers & Pages → fomometer-engine → Triggers).

**Scanner shows few rows.** Tokens drop out after 10 minutes without a snapshot. Check the universe size in the last `engine cycle` log line.

**Logos missing.** Logos go through `/api/logo/<id>?s=64|128|256` (`app/api/logo/[id]/route.ts`), which fetches DexScreener's CDN as webp, drops its cookie and caches for a week. The CDN accepts only sizes 64, 128 and 256; `components/dashboard/token-avatar.tsx` maps to those. Tokens without `image_url`, or a 404 from the route, show a letter. Each logo is a Pages Functions request (free plan: 100k a day) until the browser has it cached.

**Strategy page shows "Default".** `STRATEGY_FORMULA_JSON` is missing or invalid; the engine falls back to default weights.

## Retraining the score

1. Dump outcomes with their factors (query in the header of `research/backtest_walk_forward_stdlib.py`). Outcomes from 2026-10-15 carry their own factors; older ones only within the last 72 hours of `signals`, see [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations-of-the-design).
2. `python3 research/backtest_walk_forward_stdlib.py --input data/outcomes.json --output infra/best_meme_strategy.candidate.json --trials 1500`
3. Compare the candidate's test metrics with the current file and with the baseline (all tracked tokens, same window). Do not ship a candidate that does not beat the baseline on the test split.
4. `npx wrangler secret put STRATEGY_FORMULA_JSON -c workers/engine/wrangler.toml < infra/best_meme_strategy.json`
5. Watch one run in `wrangler tail`; `/dashboard/strategy` shows the new weights within a minute.

## Swap fees

| Item | Value |
|---|---|
| Referral account | `Fyhr9NJU2JbwdTL4ZZRRaCpnJH1eLydDnBZsc9khJBTA` (Jupiter Ultra project), created and owned by the owner's wallet |
| Fee accounts | SOL `82oUvYq9ATTPZcpiM6Jxvxca8PNLvbpSGWBY8x4qTLNa`, plus USDC, USDT and a few others created on the dashboard |
| Fee | 100 bps in `apps/web/lib/trade.ts` (Jupiter allows 50 to 255) |
| Dashboard | https://referral.jup.ag/ → Ultra |

Check that the fee is applied (no signing, read-only quote):

```bash
curl -s "https://ultra-api.jup.ag/order?inputMint=So11111111111111111111111111111111111111112&outputMint=<token mint>&amount=10000000&swapMode=ExactIn&referralAccount=Fyhr9NJU2JbwdTL4ZZRRaCpnJH1eLydDnBZsc9khJBTA&referralFee=100" | jq '{feeBps, feeMint, error}'
```

`feeBps` must be 100. A small default value (for example 2) means the token account for that `feeMint` is missing: create it on the dashboard. An occasional `"Something unexpected occurred"` from Jupiter passes on retry.

Swaps are recorded by the labeler every minute (labeling itself runs every 15 minutes) (log line `swaps stored=N seen=M` only when there were new signatures; `swaps error: …` means the RPC failed and the next minute retries). That is 9 `getSignaturesForAddress` calls a minute, about 390,000 Helius credits a month, plus one `getTransaction` per new swap. `SELECT * FROM swaps ORDER BY block_time DESC LIMIT 20` shows them. A new fee mint created on the dashboard must be added to `JUP_FEE_ACCOUNTS` in `workers/labeler/wrangler.toml` and `apps/web/lib/trade.ts`.

Balances on chain: `/api/treasury`, or `getMultipleAccounts` for the fee accounts on any RPC that serves it. Claiming is manual on the dashboard (**Claim**); it only lists verified tokens worth more than $1, smaller or unverified balances need Jupiter's referral SDK.

Phantom shows "This domain is new" for fomometer.xyz until its review clears, usually within days. If it is still there after a week, use Phantom's domain review form linked from [their docs](https://docs.phantom.com/developer-powertools/domain-and-transaction-warnings).

## On-chain signal record

The labeler writes each fresh signal to Solana as a memo from a dedicated record wallet (Architecture, Labeler).

- Cost: one transaction per labeler run with signals, 5,000 lamports per signature, up to 8 signals per transaction. About 60 signals a day is under 0.01 SOL a month. The wallet holds only this float; it is not the referral account and holds no fees.
- Start: create the keypair (`solana-keygen new -o record.json`, or the script in the journal), `wrangler secret put CHAIN_RECORD_KEY -c workers/labeler/wrangler.toml < record.json`, fund the address, set `CHAIN_RECORD_ENABLED = "true"` in `workers/labeler/wrangler.toml`, deploy the labeler. Keep `record.json` offline as the backup.
- Stop: `CHAIN_RECORD_ENABLED = "false"` and deploy.
- Check: log lines `chain posted=N landed=M lost=K`; `SELECT chain_ok, COUNT(*) FROM signal_events WHERE time > unixepoch() - 86400 GROUP BY 1` (NULL is pending or not posted); the record wallet's transactions on Solscan.
- Top up when the balance falls under 0.01 SOL. Without funds every send fails preflight and nothing is written, which the log shows as `error`.

## X account

The labeler posts to X (Architecture, Labeler). `X_POST_MODE` in `workers/labeler/wrangler.toml`:

- `off`: nothing.
- `dry`: builds each post and logs it (`x dry <kind> <ref>: <text>`), with the card URL in `x_posts`; no X calls. Use it to check posts before going live.
- `live`: posts. Needs the four secrets: `wrangler secret put X_API_KEY -c workers/labeler/wrangler.toml`, then `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` (an app with read and write permission on developer.x.com, keys of the posting account).
- Check: `SELECT kind, ref, status, tweet_id, error FROM x_posts WHERE mode = 'live' ORDER BY id DESC LIMIT 20`. `failed` rows were given up after 3 attempts.
- The profile carries X's "Automated" label, as X's rules require for bots.

## Limits to keep in mind

- Workers free plan: 50 ms CPU per run, 100k requests a day. The engine uses 1,440 runs a day.
- D1 has a daily rows-read allowance (check the account's plan). Before the October 2026 rewrite the engine read 17.9 million rows a day; keep per-minute queries indexed and bounded.
- DexScreener public API: about 300 requests a minute for pair data. The engine makes a handful per run.

## Accounts and secrets

- Cloudflare account: zone `fomometer.xyz` (nameservers at Namecheap point to Cloudflare), Pages project `fomometer-web`, Workers `fomometer-engine` and `fomometer-labeler`, D1 `fomometer`.
- Jupiter referral account and its fee accounts, owned by the owner's Solana wallet. The site holds no key for them.
- Secrets: `CLOUDFLARE_API_TOKEN` (local `.env` and GitHub), `STRATEGY_FORMULA_JSON` (engine), `HELIUS_API_KEY` (labeler, Pages production), `CHAIN_RECORD_KEY` (labeler, record wallet keypair), `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` (labeler, X account). Nothing else.
- Never paste secrets into issues, chats or commits. Rotate the API token if it leaks.
