# Cloudflare setup

FOMOMETER runs entirely on Cloudflare: Pages for the site, Workers for the crons, D1 for data. Commands run from the repository root with `wrangler` 4.

## 1. Credentials

Create an API token (My Profile → API Tokens → template "Edit Cloudflare Workers", plus Account · D1 · Edit; Cloudflare Pages · Edit is in the template). Put it in `.env`:

```bash
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

`wrangler` reads `.env` only from the directory it runs in. The `pnpm deploy:*` scripts run inside each package, so export the root `.env` first:

```bash
set -a; . ./.env; set +a
npx wrangler whoami
```

## 2. D1

```bash
npx wrangler d1 create fomometer
# put the returned database_id into:
#   apps/web/wrangler.toml, workers/engine/wrangler.toml, workers/labeler/wrangler.toml
pnpm d1:apply:remote          # applies infra/d1-schema.sql
```

## 3. KV

Not used. No worker or the site binds a KV namespace.

## 4. Secrets

The site needs none. The engine reads the fitted score weights and thresholds from one secret:

```bash
npx wrangler secret put STRATEGY_FORMULA_JSON -c workers/engine/wrangler.toml   # contents of infra/best_meme_strategy.json
```

Without it the engine uses default weights and fixed or adaptive thresholds.

## 5. Site (Pages)

```bash
pnpm deploy:web               # next-on-pages build + wrangler pages deploy (project fomometer-web)
```

Custom domain: Workers & Pages → fomometer-web → Custom domains → add `fomometer.xyz` and `www.fomometer.xyz`. The zone must be on the same Cloudflare account; the CNAME records are created automatically.

## 6. Workers (crons)

```bash
pnpm deploy:engine            # every minute
pnpm deploy:labeler           # every 15 minutes
```

## 7. Verify

- `https://fomometer.xyz` renders the landing page with a live table.
- The LIVE badge is green: prices are less than 3 minutes old (`/api/status`).
- `/dashboard/strategy` shows current thresholds and, after a few hours, a track record.
- Engine health: Workers & Pages → fomometer-engine → Logs. Every run should end with `ok`; `exceededCpu` means scoring is not completing.
