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
/** Baseline: one sample of every scored token per slot. */
const BASELINE_SLOT_SEC = 30 * 60;
/** The slot's sample is the first engine run within this long after the slot starts (runs can skip minutes). */
const BASELINE_RUN_WINDOW_SEC = 5 * 60;
/** Slots processed per run, so a backlog (first run, outage) catches up gradually. */
const BASELINE_MAX_SLOTS = 8;
/** First run starts this far back; snapshots are kept 72 h. */
const BASELINE_START_BACK_SEC = 68 * 3600;
/** Track record summary for the Strategy page: window and refresh interval. */
const RECORD_DAYS = 7;
const RECORD_REFRESH_SEC = 60 * 60;

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

  const baselineSlots = await fillBaseline(env, now);

  const events = rows.results ?? [];
  let labeled = 0;
  let skipped = 0;
  for (const e of events) {
    const ok = await labelOne(env, e, now);
    if (ok) labeled++;
    else skipped++;
  }

  const recordUpdated = await updateTrackRecord(env, now);

  console.log(
    `labeler: scanned=${events.length} labeled=${labeled} skipped=${skipped} baseline slots=${baselineSlots} record=${recordUpdated ? 'updated' : 'kept'} in ${Date.now() - t0}ms`
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

/**
 * Baseline for the track record: every token the engine scored in its first run of
 * each 30-minute slot, priced at 15 m, 1 h and 4 h with the same tolerance as events, plus the
 * best price in the 4 h window (same suspect-price rule). Slots are processed once
 * their horizon plus tolerance has passed; the cursor lives in engine_state.
 * All work is one INSERT ... SELECT per slot, so the worker parses nothing.
 */
async function fillBaseline(env: Env, now: number): Promise<number> {
  // The sample can come from a run up to BASELINE_RUN_WINDOW_SEC into the slot, and its
  // 4 h price up to HORIZON_TOLERANCE_SEC after that: wait for both.
  const ready = now - HORIZON_4H_SEC - HORIZON_TOLERANCE_SEC - BASELINE_RUN_WINDOW_SEC;
  const cur = await env.DB.prepare(`SELECT value FROM engine_state WHERE key = 'baseline_cursor'`).first<{
    value: string;
  }>();
  const parsed = cur ? parseInt(cur.value, 10) : NaN;
  let slot = Number.isFinite(parsed)
    ? parsed + BASELINE_SLOT_SEC
    : Math.ceil((now - BASELINE_START_BACK_SEC) / BASELINE_SLOT_SEC) * BASELINE_SLOT_SEC;

  let done = 0;
  for (; slot <= ready && done < BASELINE_MAX_SLOTS; slot += BASELINE_SLOT_SEC, done++) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO baseline_outcomes
           (address, sample_time, entry_price, price_15m, price_1h, price_4h, max_price_4h)
         SELECT s.address, s.time, e.price_usd,
           (SELECT x.price_usd FROM token_snapshots x WHERE x.address = s.address
              AND x.time >= s.time + 900 AND x.time <= s.time + 900 + ?3 ORDER BY x.time LIMIT 1),
           (SELECT x.price_usd FROM token_snapshots x WHERE x.address = s.address
              AND x.time >= s.time + 3600 AND x.time <= s.time + 3600 + ?3 ORDER BY x.time LIMIT 1),
           (SELECT x.price_usd FROM token_snapshots x WHERE x.address = s.address
              AND x.time >= s.time + ?2 AND x.time <= s.time + ?2 + ?3 ORDER BY x.time LIMIT 1),
           (SELECT MAX(x.price_usd) FROM token_snapshots x WHERE x.address = s.address
              AND x.time > s.time AND x.time <= s.time + ?2)
         FROM signals s
         JOIN token_snapshots e ON e.address = s.address AND e.time = s.time
         WHERE s.time = (SELECT MIN(time) FROM signals WHERE time >= ?1 AND time < ?1 + ?4)
           AND e.price_usd > 0`
      ).bind(slot, HORIZON_4H_SEC, HORIZON_TOLERANCE_SEC, BASELINE_RUN_WINDOW_SEC),
      env.DB.prepare(
        `INSERT INTO engine_state (key, value, updated_at) VALUES ('baseline_cursor', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind(String(slot), now)
    ]);
  }
  return done;
}

type HorizonStats = { n: number; favorable: number | null; median_pct: number | null };
type GroupStats = {
  /** Outcomes in the window, including flagged ones. */
  n: number;
  /** Left out of every statistic: best price above 11x entry (suspect pool switch). */
  flagged: number;
  /** Not flagged, but no price within the tolerance after 4 h. */
  lost_4h: number;
  horizons: Record<'15m' | '1h' | '4h', HorizonStats>;
};

/**
 * Summary of the last RECORD_DAYS for the Strategy page, stored in
 * engine_state.track_record so the site reads one row instead of thousands per
 * request. Outcomes only change when this worker runs; refreshed hourly.
 * "Favorable" is direction-aware (price down after SELL); the baseline counts
 * price up. Medians, not means: a few 10x moves would dominate an average.
 */
async function updateTrackRecord(env: Env, now: number): Promise<boolean> {
  const prev = await env.DB.prepare(`SELECT updated_at FROM engine_state WHERE key = 'track_record'`).first<{
    updated_at: number;
  }>();
  if (prev && now - prev.updated_at < RECORD_REFRESH_SEC) return false;

  const since = now - RECORD_DAYS * 86400;
  const [ev, base, first] = await env.DB.batch<Record<string, number | string | null>>([
    env.DB.prepare(
      `SELECT event_type, pnl_pct_15m, pnl_pct_1h, pnl_pct_4h, price_flag
         FROM signal_outcomes WHERE event_time >= ?`
    ).bind(since),
    env.DB.prepare(
      `SELECT entry_price, price_15m, price_1h, price_4h, max_price_4h
         FROM baseline_outcomes WHERE sample_time >= ?`
    ).bind(since),
    env.DB.prepare(`SELECT MIN(sample_time) AS t FROM baseline_outcomes`)
  ]);

  const events: Record<string, GroupStats> = {};
  for (const type of ['buy_trigger', 'sell_trigger', 'fomo_spike']) {
    const rows = (ev?.results ?? []).filter((r) => r.event_type === type);
    events[type] = summarize(
      rows.map((r) => ({
        flagged: r.price_flag != null,
        '15m': num(r.pnl_pct_15m),
        '1h': num(r.pnl_pct_1h),
        '4h': num(r.pnl_pct_4h)
      })),
      type === 'sell_trigger'
    );
  }

  const pct = (p: number | null, entry: number): number | null => (p == null || p <= 0 ? null : ((p - entry) / entry) * 100);
  const baseline = summarize(
    (base?.results ?? []).map((r) => {
      const entry = num(r.entry_price) ?? 0;
      const hi = pct(num(r.max_price_4h), entry);
      return {
        flagged: hi != null && hi > SUSPECT_RISE_PCT,
        '15m': pct(num(r.price_15m), entry),
        '1h': pct(num(r.price_1h), entry),
        '4h': pct(num(r.price_4h), entry)
      };
    }),
    false
  );

  const value = {
    at: now,
    days: RECORD_DAYS,
    events,
    baseline: { ...baseline, first_sample: num(first?.results?.[0]?.t) }
  };
  await env.DB.prepare(
    `INSERT INTO engine_state (key, value, updated_at) VALUES ('track_record', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(JSON.stringify(value), now)
    .run();
  return true;
}

type Priced = { flagged: boolean; '15m': number | null; '1h': number | null; '4h': number | null };

function summarize(rows: Priced[], down: boolean): GroupStats {
  const clean = rows.filter((r) => !r.flagged);
  const horizons = {} as GroupStats['horizons'];
  for (const h of ['15m', '1h', '4h'] as const) {
    const xs = clean.map((r) => r[h]).filter((x): x is number => x != null && Number.isFinite(x));
    const fav = xs.filter((x) => (down ? x < 0 : x > 0)).length;
    horizons[h] = { n: xs.length, favorable: xs.length ? fav / xs.length : null, median_pct: median(xs) };
  }
  return {
    n: rows.length,
    flagged: rows.length - clean.length,
    lost_4h: clean.filter((r) => r['4h'] == null).length,
    horizons
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
