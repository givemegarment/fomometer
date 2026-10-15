/**
 * FOMOMETER — Outcome labeler cron worker
 *
 * Runs every 15 minutes. For each signal_event whose 4-hour lookahead has
 * elapsed (and which is not yet labeled), pulls the 15m / 1h / 4h forward
 * prices from token_snapshots and writes a row into signal_outcomes.
 *
 * The output table is the *ground truth* used by walk-forward backtests,
 * fallback-weight optimization and the dashboard accuracy panel. We label
 * automatically rather than wait for user feedback so the loop is closed
 * even before the product has many users.
 *
 * Each outcome also keeps the event's factor vectors (signal_outcomes is never
 * pruned, signal_events and signals are), and a price_flag when the price rose
 * more than SUSPECT_RISE_PCT inside the window: on DexScreener that is almost
 * always a switch to a different pool, not a trade anyone could have made.
 */

export interface Env {
  DB: D1Database;
  LABELER_LOOKBACK_HOURS: string;
  LABELER_BATCH_SIZE: string;
}

const HORIZON_4H_SEC = 4 * 3600;
/** A horizon price must come from a snapshot at most this long after the horizon; otherwise it is missing. */
const HORIZON_TOLERANCE_SEC = 10 * 60;
/** Best price in the 4 h window above entry by more than this (percent) marks the outcome as suspect. */
const SUSPECT_RISE_PCT = 1000;

export default {
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runOnce(env).catch((err) => console.error('labeler error', err)));
  },
  async fetch(_req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    ctx.waitUntil(runOnce(env).catch((err) => console.error('labeler error', err)));
    return new Response('labeler: cycle started\n');
  }
} satisfies ExportedHandler<Env>;

type EventRow = {
  id: number;
  address: string;
  time: number;
  event_type: string;
  score: number;
};

async function runOnce(env: Env): Promise<void> {
  const t0 = Date.now();
  const now = Math.floor(Date.now() / 1000);
  const lookbackSec = (parseInt(env.LABELER_LOOKBACK_HOURS, 10) || 12) * 3600;
  const batchSize = parseInt(env.LABELER_BATCH_SIZE, 10) || 500;

  // Pick events whose 4h horizon plus the tolerance has elapsed (so every snapshot
  // that could price the horizon already exists) and which we have not yet
  // labeled. Bound by a lookback to avoid replaying ancient events.
  const cutoffNewest = now - HORIZON_4H_SEC - HORIZON_TOLERANCE_SEC;
  const cutoffOldest = now - lookbackSec - HORIZON_4H_SEC;

  const rows = await env.DB.prepare(
    `SELECT e.id, e.address, e.time, e.event_type, e.score
       FROM signal_events e
       LEFT JOIN signal_outcomes o ON o.event_id = e.id
       WHERE o.event_id IS NULL
         AND e.time <= ?
         AND e.time >= ?
       ORDER BY e.time ASC
       LIMIT ?`
  )
    .bind(cutoffNewest, cutoffOldest, batchSize)
    .all<EventRow>();

  const events = rows.results ?? [];
  if (events.length === 0) {
    console.log('labeler: nothing to label');
    return;
  }

  let labeled = 0;
  let skipped = 0;
  for (const e of events) {
    const ok = await labelOne(env, e, now);
    if (ok) labeled++;
    else skipped++;
  }

  console.log(
    `labeler: scanned=${events.length} labeled=${labeled} skipped=${skipped} in ${Date.now() - t0}ms`
  );
}

async function labelOne(env: Env, e: EventRow, now: number): Promise<boolean> {
  // Entry price: snapshot at or just before the event.
  const entryRow = await env.DB.prepare(
    `SELECT price_usd, time FROM token_snapshots
       WHERE address = ? AND time <= ?
       ORDER BY time DESC LIMIT 1`
  )
    .bind(e.address, e.time)
    .first<{ price_usd: number; time: number }>();
  if (!entryRow || !Number.isFinite(entryRow.price_usd) || entryRow.price_usd <= 0) {
    return false;
  }

  const entry = entryRow.price_usd;
  const price15m = await firstPriceAtOrAfter(env, e.address, e.time + 15 * 60);
  const price1h = await firstPriceAtOrAfter(env, e.address, e.time + 60 * 60);
  const price4h = await firstPriceAtOrAfter(env, e.address, e.time + HORIZON_4H_SEC);

  const pct = (p: number | null): number | null => {
    if (p == null || !Number.isFinite(p) || p <= 0) return null;
    return ((p - entry) / entry) * 100;
  };

  // Best/worst PnL within the 4h lookahead window.
  const extr = await env.DB.prepare(
    `SELECT MAX(price_usd) AS hi, MIN(price_usd) AS lo
       FROM token_snapshots
       WHERE address = ? AND time > ? AND time <= ?`
  )
    .bind(e.address, e.time, e.time + HORIZON_4H_SEC)
    .first<{ hi: number | null; lo: number | null }>();
  const maxPnl = pct(extr?.hi ?? null);
  const minPnl = pct(extr?.lo ?? null);
  const priceFlag = maxPnl != null && maxPnl > SUSPECT_RISE_PCT ? 'rise_over_1000pct' : null;

  await env.DB.prepare(
    `INSERT OR REPLACE INTO signal_outcomes
       (event_id, address, event_time, event_type, entry_price,
        price_15m, price_1h, price_4h,
        pnl_pct_15m, pnl_pct_1h, pnl_pct_4h,
        max_pnl_pct_4h, min_pnl_pct_4h, labeled_at,
        price_flag, factors_json)
     VALUES (?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?,
             ?, (SELECT json_extract(metadata_json, '$.factors') FROM signal_events WHERE id = ?))`
  )
    .bind(
      e.id,
      e.address,
      e.time,
      e.event_type,
      entry,
      price15m,
      price1h,
      price4h,
      pct(price15m),
      pct(price1h),
      pct(price4h),
      maxPnl,
      minPnl,
      now,
      priceFlag,
      e.id
    )
    .run();

  return true;
}

async function firstPriceAtOrAfter(
  env: Env,
  address: string,
  t: number
): Promise<number | null> {
  const r = await env.DB.prepare(
    `SELECT price_usd FROM token_snapshots
       WHERE address = ? AND time >= ? AND time <= ?
       ORDER BY time ASC LIMIT 1`
  )
    .bind(address, t, t + HORIZON_TOLERANCE_SEC)
    .first<{ price_usd: number }>();
  return r && Number.isFinite(r.price_usd) ? r.price_usd : null;
}
