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

| Check | How | Healthy |
|---|---|---|
| Data freshness | `curl https://fomometer.xyz/api/status` | `snapshot_at` and `scored_at` within 2 minutes of now and equal to each other |
| Engine runs | `cd workers/engine && npx wrangler tail fomometer-engine --format json` | every run `"outcome":"ok"`, log line `engine cycle: N tokens …` |
| Scanner | `curl https://fomometer.xyz/api/scanner` | 20 to 50 rows |
| Labeler | `SELECT MAX(labeled_at) FROM signal_outcomes` | within 30 minutes |

D1 queries: `npx wrangler d1 execute fomometer --remote --command "…"` (run inside `workers/engine` so the binding resolves).

## Incidents

**STALE badge, `scored_at` behind `snapshot_at`.** The engine stores prices but dies before scoring. Run `wrangler tail`. `exceededCpu` means the run went over the 50 ms CPU limit of the free plan: look for a new per-minute query that pulls many rows or parses JSON in the worker. This is what happened before October 2026 (the burst percentile parsed ~9,000 rows a minute).

**STALE badge, both times behind.** The engine is not running or DexScreener returns nothing. Tail logs: `empty universe, skipping` repeated means DexScreener; no logs at all means the cron is off (Workers & Pages → fomometer-engine → Triggers).

**Scanner shows few rows.** Tokens drop out after 10 minutes without a snapshot. Check the universe size in the last `engine cycle` log line.

**Logos missing.** Logos go through `/api/logo/<id>?s=64|128|256` (`app/api/logo/[id]/route.ts`), which fetches DexScreener's CDN as webp, drops its cookie and caches for a week. The CDN accepts only sizes 64, 128 and 256; `components/dashboard/token-avatar.tsx` maps to those. Tokens without `image_url`, or a 404 from the route, show a letter. Each logo is a Pages Functions request (free plan: 100k a day) until the browser has it cached.

**Strategy page shows "Default".** `STRATEGY_FORMULA_JSON` is missing or invalid; the engine falls back to default weights.

## Retraining the score

1. Dump outcomes with their factors (query in the header of `research/backtest_walk_forward_stdlib.py`). Outcomes from 2026-10-15 carry their own factors; older ones only within the last 72 hours of `signals`, see [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations-of-the-design).
2. `python3 research/backtest_walk_forward_stdlib.py --input data/outcomes.json --output infra/best_meme_strategy.candidate.json --trials 1500`
3. Compare the candidate's test metrics with the current file and with the baseline (all tracked tokens, same window). Do not ship a candidate that does not beat the baseline on the test split.
4. `npx wrangler secret put STRATEGY_FORMULA_JSON -c workers/engine/wrangler.toml < infra/best_meme_strategy.json`
5. Watch one run in `wrangler tail`; `/dashboard/strategy` shows the new weights within a minute.

## Limits to keep in mind

- Workers free plan: 50 ms CPU per run, 100k requests a day. The engine uses 1,440 runs a day.
- D1 has a daily rows-read allowance (check the account's plan). Before the October 2026 rewrite the engine read 17.9 million rows a day; keep per-minute queries indexed and bounded.
- DexScreener public API: about 300 requests a minute for pair data. The engine makes a handful per run.

## Accounts and secrets

- Cloudflare account: zone `fomometer.xyz` (nameservers at Namecheap point to Cloudflare), Pages project `fomometer-web`, Workers `fomometer-engine` and `fomometer-labeler`, D1 `fomometer`.
- Secrets: `CLOUDFLARE_API_TOKEN` (local `.env` and GitHub), `STRATEGY_FORMULA_JSON` (engine). Nothing else.
- Never paste secrets into issues, chats or commits. Rotate the API token if it leaks.
