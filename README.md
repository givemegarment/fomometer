# FOMOMETER

Scores Solana memecoins every minute from public market data. Live at [fomometer.xyz](https://fomometer.xyz).

FOMOMETER tracks the Solana tokens on DexScreener's boosted lists, computes 12 market factors for each one, combines 7 of them into a 0 to 100 score and records BUY, SELL and volume-burst signals when thresholds are crossed. It also publishes how past signals played out. There are no accounts, no wallets and no trading.

The full method, including its limitations, is in [docs/METHODOLOGY.md](docs/METHODOLOGY.md) and on the site at `/how-it-works`.

## Documentation

| Document | What it covers |
|---|---|
| [Whitepaper](docs/WHITEPAPER.md) | Problem, method, evidence so far, principles, business model, token plan, risks |
| [Methodology](docs/METHODOLOGY.md) | Factors, score, signals, quality filter, track record, limitations (same text as `/how-it-works`) |
| [Architecture](docs/ARCHITECTURE.md) | Engine cycle, labeler, data model, JSON API, configuration, known design limits |
| [Operations](docs/OPERATIONS.md) | Deploy, health checks, incidents, retraining, platform limits |
| [Roadmap](docs/ROADMAP.md) | Phases from data integrity to signal research, Pro, API and token |
| [Tokenomics](docs/TOKENOMICS.md) | Proposed token, revenue split, buyback and burn, holder access, safeguards |
| [Cloudflare setup](infra/cloudflare-setup.md) | Setting up the stack from scratch |

> Not financial advice. FOMOMETER publishes statistics about market data. It does not recommend buying or selling any token.

## Architecture

```
DexScreener API
      │  every minute
      ▼
workers/engine   ──►  Cloudflare D1  ◄──  apps/web (Next.js on Cloudflare Pages, read-only)
  snapshots, factors,     ▲
  scores, signals         │  every 15 minutes
                    workers/labeler
                    price 15m / 1h / 4h after each signal
```

| Path | What it is |
|---|---|
| `apps/web` | Next.js 14 (App Router), Tailwind, next-intl (English; all copy in `messages/en.json`). Landing, method page, dashboard. All API routes are read-only `SELECT`s against D1. |
| `workers/engine` | Cron every minute: fetches DexScreener, stores snapshots, computes factors and scores, emits signal events. |
| `workers/labeler` | Cron every 15 minutes: records the price 15 minutes, 1 hour and 4 hours after each signal (`signal_outcomes`). |
| `packages/shared` | Factor math, scoring, DexScreener client, shared types. |
| `infra/` | D1 schema, Cloudflare setup notes, trained strategy file. |
| `research/` | Offline walk-forward trainer that fits score weights and thresholds. Python standard library only. The approach started from [AlphaGPT](https://github.com/imbue-bit/AlphaGPT) (Apache 2.0); its code is not included. |
| `docs/` | Whitepaper, methodology, architecture, operations, roadmap, tokenomics, work journals, archive. |

The site has no login. The watchlist is stored in the visitor's browser (`localStorage`).

## Local development

Requirements: Node 20, pnpm 9.

```bash
pnpm install
pnpm dev            # apps/web on http://localhost:3000
```

`next dev` has no Cloudflare bindings, so the dashboard shows empty states. To run the built site against the production database (read-only, since every API route is a `SELECT`):

```bash
cd apps/web
npx @cloudflare/next-on-pages
# a wrangler.toml copy with `remote = true` on the D1 binding, then:
npx wrangler pages dev --port 8788
```

Checks:

```bash
pnpm -F @fomometer/web typecheck
pnpm -F @fomometer/web lint
pnpm -F @fomometer/web build
```

## Deployment

Everything runs on Cloudflare: Pages for the site, Workers for the crons, D1 for data. See [infra/cloudflare-setup.md](infra/cloudflare-setup.md).

```bash
set -a; . ./.env; set +a   # wrangler runs inside each package and does not see the root .env on its own
pnpm deploy:web       # build with next-on-pages and deploy to Pages
pnpm deploy:engine
pnpm deploy:labeler
```

GitHub Actions: `ci.yml` runs typecheck, unit tests (`pnpm test`) and build on every push and pull request. `deploy-pages.yml` and `deploy-workers.yml` do the same deploys, started by hand from the Actions tab, once the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets are set.

## Retraining the score

```bash
pnpm d1:export                  # pull the D1 database locally
pnpm train:walk-forward         # writes infra/best_meme_strategy.json
```

The engine reads the fitted weights and thresholds from the `STRATEGY_FORMULA_JSON` worker secret. See [research/README_walk_forward.md](research/README_walk_forward.md).
