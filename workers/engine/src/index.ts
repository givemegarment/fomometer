/**
 * FOMOMETER — Engine cron worker
 * Runs every minute. Steps:
 *  1. Determine target token universe = Top-N DexScreener boosted Solana tokens.
 *  2. Snapshot via DexScreener (batches of 30).
 *  3. Persist tokens + token_snapshots.
 *  4. Compute the 12-factor vector per token on a rolling window (one D1 query for all tokens).
 *  5. Run StackVM (or fallback) → score, factors_json. Write to signals.
 *  6. Detect transitions (BUY/SELL/FOMO_SPIKE) → signal_events. All writes go in one D1 batch.
 *
 * CPU budget: the worker runs under a tight per-invocation CPU limit, so D1 round
 * trips are batched and nothing parses large JSON in the worker.
 *  7. Prune old data per retention.
 */
import {
  DexScreenerClient,
  pairToSnapshot,
  computeFactors,
  computeScore,
  computePopulationStats,
  normalizeByPopulation,
  detectMarketRegime,
  adaptiveThresholds,
  DEFAULT_FALLBACK_WEIGHTS,
  type Snapshot,
  type FactorVector,
  type Strategy,
  type MarketRegime,
  type FallbackWeights,
  FACTOR_KEYS
} from '@fomometer/shared';

export interface Env {
  DB: D1Database;
  ENGINE_CHAIN: string;
  ENGINE_TOP_N: string;
  ENGINE_BUY_THRESHOLD: string;
  ENGINE_SELL_THRESHOLD: string;
  ENGINE_HISTORY_RETENTION_HOURS: string;
  DEXSCREENER_BASE_URL: string;
  STRATEGY_FALLBACK_MODE: string;
  /** Optional: bound the formula JSON via secret (or fall back to bundled). */
  STRATEGY_FORMULA_JSON?: string;
  /** Optional: '1' / 'true' to enable adaptive percentile thresholds. */
  ENGINE_ADAPTIVE_THRESHOLDS?: string;
  /** Optional: '1' / 'true' to enable cross-sectional z-score normalization. */
  ENGINE_CROSS_SECTIONAL_NORM?: string;
  /** Optional: '1' / 'true' to enable market-regime weight adjustment. */
  ENGINE_REGIME_AWARE?: string;
  /** Optional: minimum snapshots in the rolling window before BUY/SELL transitions can fire. */
  ENGINE_WARM_UP_MIN?: string;
  /** Quality prefilter — minimum DexScreener liquidity USD before BUY/SELL/FOMO can emit. */
  ENGINE_MIN_LIQUIDITY_USD?: string;
  /** Quality prefilter — minimum buys_h1 / sells_h1 ratio. */
  ENGINE_BS_RATIO_MIN?: string;
  /** Quality prefilter — maximum buys_h1 / sells_h1 ratio. */
  ENGINE_BS_RATIO_MAX?: string;
  /** Quality prefilter — block emission when price_change_h1 in (LO, HI] (exhausted pump). */
  ENGINE_PUMP_BLOCK_LO?: string;
  ENGINE_PUMP_BLOCK_HI?: string;
}

const ROLLING_WINDOW_MIN = 90;       // factors look back ≤ 90 minutes (was 60)
const DEFAULT_WARM_UP_MIN = 10;      // need ≥ N snapshots before MA/RSI factors are trusted (DexScreener trending rotates fast, so 10 is a realistic floor)
const ADAPTIVE_LOOKBACK_HOURS = 6;   // window over which BUY/SELL percentiles are computed
const FOMO_FACTOR_INDEX = 3;         // index of `fomo` in FactorVector
const FOMO_FALLBACK_THRESHOLD = 2.5; // used only when adaptive percentile is unavailable
const FOMO_PERCENTILE = 0.95;        // FOMO spike fires above 95th percentile of recent fomo factor
const FOMO_TH_REFRESH_SEC = 30 * 60; // adaptive FOMO threshold is recomputed at most every 30 min

// Quality prefilter defaults — empirically validated against 609 labeled events.
// Population stats: liq<$25k → 37% hit, liq≥$25k → 53-58% hit; b/s≥3.0 → 37% hit/-13.7% avg;
// price_change_h1 ∈ (50,100]% → 17% hit/-5.9% avg. See research/ for the trainer.
const DEFAULT_MIN_LIQUIDITY_USD = 25000;
const DEFAULT_BS_RATIO_MIN = 0.8;
const DEFAULT_BS_RATIO_MAX = 3.0;
const DEFAULT_PUMP_BLOCK_LO = 50;
const DEFAULT_PUMP_BLOCK_HI = 100;

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runOnce(env).catch((e) => console.error('engine error', e)));
  },
  // Manual trigger for local dev: GET / runs the cycle once.
  async fetch(_req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    ctx.waitUntil(runOnce(env).catch((e) => console.error('engine error', e)));
    return new Response('engine: cycle started\n');
  }
} satisfies ExportedHandler<Env>;

async function runOnce(env: Env): Promise<void> {
  const t0 = Date.now();
  const now = Math.floor(t0 / 1000);
  const topN = parseInt(env.ENGINE_TOP_N, 10) || 50;

  const ds = new DexScreenerClient(env.DEXSCREENER_BASE_URL);

  // 1. Universe = boosted top-N (the site's watchlist lives in the browser, not in D1).
  const trending = await ds.getTrendingSolana();
  const universe = Array.from(new Set(trending.slice(0, topN).map((t) => t.tokenAddress)));
  if (universe.length === 0) {
    console.log('engine: empty universe, skipping');
    return;
  }

  // 2. Snapshot in batches of 30.
  const pairs = await Promise.all(
    chunk(universe, 30).map((c) => ds.getTokensBatch(c))
  ).then((parts) => parts.flat());

  // Build snapshots map keyed by address.
  const snapByAddr = new Map<string, Snapshot>();
  for (const p of pairs) {
    snapByAddr.set(p.baseToken.address, pairToSnapshot(p, now));
  }

  if (snapByAddr.size === 0) {
    console.log('engine: no pairs returned');
    return;
  }

  // 3. Persist tokens + snapshots.
  await persistTokensAndSnapshots(env, pairs, snapByAddr, now);

  // 4. Compute raw factors per token (single pass, before normalization / scoring).
  const strategy = await loadStrategy(env);
  const trainedWeights = extractWeights(strategy);
  const useNorm = isFlagOn(env.ENGINE_CROSS_SECTIONAL_NORM);
  const useRegime = isFlagOn(env.ENGINE_REGIME_AWARE);
  const useAdaptive = isFlagOn(env.ENGINE_ADAPTIVE_THRESHOLDS);
  const warmUpMin = parseInt(env.ENGINE_WARM_UP_MIN ?? '', 10) || DEFAULT_WARM_UP_MIN;

  type Computed = {
    addr: string;
    factorsRaw: FactorVector;
    factorsScored: FactorVector;   // either raw or population-normalized
    snapshots: number;
    warm: boolean;
  };

  const windows = await loadRollingWindows(env, [...snapByAddr.keys()], now, ROLLING_WINDOW_MIN);
  const computed: Computed[] = [];
  for (const [addr, snap] of snapByAddr) {
    const window = windows.get(addr) ?? [];
    if (window.length === 0) window.push(snap);
    const factorsRaw = computeFactors(window);
    computed.push({
      addr,
      factorsRaw,
      factorsScored: factorsRaw,
      snapshots: window.length,
      warm: window.length >= warmUpMin
    });
  }

  // 4b. Cross-sectional z-score normalization across the universe at this tick.
  if (useNorm && computed.length >= 5) {
    const stats = computePopulationStats(computed.map((c) => c.factorsRaw));
    for (const c of computed) c.factorsScored = normalizeByPopulation(c.factorsRaw, stats);
  }

  // 4c. Score every token using the (possibly normalized) factor vector.
  const scored = computed.map((c) => {
    const { score, mode } = computeScore(c.factorsScored, strategy, { weights: trainedWeights });
    return { ...c, score, mode };
  });

  // 4d. Detect market regime from the just-computed score distribution.
  const regime: MarketRegime | undefined = useRegime
    ? detectMarketRegime(
        scored.map((s) => s.score),
        scored.map((s) => s.factorsScored)
      )
    : undefined;

  // 4e. If regime-aware AND we used fallback for some, re-score those with adjusted weights.
  if (useRegime && regime && regime !== 'neutral') {
    for (const s of scored) {
      if (s.mode === 'fallback') {
        const r = computeScore(s.factorsScored, strategy, { regime, weights: trainedWeights });
        s.score = r.score;
      }
    }
  }

  // 4f. Resolve BUY/SELL/FOMO thresholds — priority:
  //      trained (strategy.meta.thresholds) > adaptive (percentile) > fixed (env).
  // Trained thresholds win because the trainer optimized weights *jointly* with
  // these specific cutoffs. Adaptive percentile is the runtime-only fallback
  // when no trained pair is available.
  const fixedBuy = parseFloat(env.ENGINE_BUY_THRESHOLD) || 0.7;
  const fixedSell = parseFloat(env.ENGINE_SELL_THRESHOLD) || 0.3;
  const trainedTh = extractThresholds(strategy);
  let buyTh = trainedTh?.buy ?? fixedBuy;
  let sellTh = trainedTh?.sell ?? fixedSell;
  let fomoTh = FOMO_FALLBACK_THRESHOLD;
  let thresholdsAdaptive = false;

  // Skip the BUY/SELL percentile path when trained thresholds are present —
  // they're jointly optimized with the weights and shouldn't be overridden by
  // a noisy 6-hour score sample. We still let FOMO threshold adapt because
  // the trainer doesn't currently calibrate it.
  if (useAdaptive && !trainedTh) {
    const lookbackSec = ADAPTIVE_LOOKBACK_HOURS * 3600;
    const recent = await env.DB.prepare(
      `SELECT score FROM signals WHERE time >= ?`
    )
      .bind(now - lookbackSec)
      .all<{ score: number }>();
    const sample = (recent.results ?? []).map((r) => r.score);
    const adapt = adaptiveThresholds(sample, {
      fallbackBuy: fixedBuy,
      fallbackSell: fixedSell
    });
    buyTh = adapt.buy;
    sellTh = adapt.sell;
    thresholdsAdaptive = adapt.adaptive;
  }

  if (useAdaptive) {
    // Adaptive FOMO threshold: 95th percentile of `fomo` over the same window, computed in SQL.
    fomoTh = await loadFomoThreshold(env, now) ?? FOMO_FALLBACK_THRESHOLD;
  }

  // Quality prefilter — kills low-liquidity rugs, FOMO-peak exhaustion, and 50-100%
  // pumps before they emit events. Signals still persist for observability.
  const qf = readQualityFilter(env);

  // 5–6. Persist signals and emit transition events. Reads first (previous scores, FOMO
  // throttle), then every write in a single batch.
  const eligible = scored.filter((c) => c.warm && passesQualityFilter(snapByAddr.get(c.addr), qf));
  const filteredOut = scored.filter((c) => c.warm).length - eligible.length;
  const eligibleAddrs = eligible.map((c) => c.addr);
  const prevScores = await loadPrevScores(env, eligibleAddrs, now);
  const fomoThrottled = await loadFomoThrottled(env, now);

  let buyTriggers = 0;
  let sellTriggers = 0;
  let fomoSpikes = 0;
  const flags = new Map<string, { buy: boolean; sell: boolean }>();
  const eventStmts: D1PreparedStatement[] = [];
  for (const c of eligible) {
    const { addr, score } = c;
    const prevScore = prevScores.get(addr) ?? null;

    if (prevScore != null && prevScore < buyTh && score >= buyTh) {
      buyTriggers++;
      flags.set(addr, { buy: true, sell: false });
      eventStmts.push(eventStmt(env, addr, now, 'buy_trigger', score, prevScore, regime, buyTh));
    } else if (prevScore != null && prevScore >= buyTh && score <= sellTh) {
      sellTriggers++;
      flags.set(addr, { buy: false, sell: true });
      eventStmts.push(eventStmt(env, addr, now, 'sell_trigger', score, prevScore, regime, sellTh));
    }

    // FOMO spike: tagged factor (raw, not normalized — we want the magnitude).
    const fomoFactor = c.factorsRaw[FOMO_FACTOR_INDEX] ?? 0;
    if (fomoFactor > fomoTh && !fomoThrottled.has(addr)) {
      fomoSpikes++;
      eventStmts.push(eventStmt(env, addr, now, 'fomo_spike', score, prevScore, regime, fomoTh));
    }
  }

  // Signal rows for every scored token (the *scored* vector — what the engine actually used),
  // then events. Warm-up / quality gates only suppress events, never signal rows.
  const signalStmts = scored.map((c) => {
    const f = flags.get(c.addr);
    return env.DB.prepare(
      `INSERT OR REPLACE INTO signals (address, time, score, factors_json, is_buy, is_sell)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(c.addr, now, c.score, JSON.stringify(factorsObject(c.factorsScored)), f?.buy ? 1 : 0, f?.sell ? 1 : 0);
  });
  await env.DB.batch([...signalStmts, ...eventStmts]);

  // 7. Prune old data.
  await pruneOldData(env, parseInt(env.ENGINE_HISTORY_RETENTION_HOURS, 10) || 72);

  // Update engine state cursor.
  await env.DB.prepare(
    `INSERT INTO engine_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
  )
    .bind(
      'last_run',
      JSON.stringify({
        at: now,
        universe: universe.length,
        snapshots: snapByAddr.size,
        buy_triggers: buyTriggers,
        sell_triggers: sellTriggers,
        fomo_spikes: fomoSpikes,
        latency_ms: Date.now() - t0,
        strategy_mode: strategy.mode,
        regime: regime ?? null,
        buy_th: buyTh,
        sell_th: sellTh,
        fomo_th: fomoTh,
        thresholds_adaptive: thresholdsAdaptive,
        thresholds_trained: !!trainedTh,
        weights_trained: !!trainedWeights,
        // Base weights of the score (before the regime multipliers), for the Strategy page.
        weights: trainedWeights ?? DEFAULT_FALLBACK_WEIGHTS,
        normalize_cross_sectional: useNorm,
        regime_aware: useRegime,
        filtered_out: filteredOut,
        quality_filter: qf
      }),
      now
    )
    .run();

  console.log(
    `engine cycle: ${snapByAddr.size} tokens, +${buyTriggers}b/${sellTriggers}s/${fomoSpikes}f (filt ${filteredOut}), regime=${regime ?? 'off'}, th=${buyTh.toFixed(2)}/${sellTh.toFixed(2)}, ${Date.now() - t0}ms`
  );
}

type QualityFilter = {
  minLiquidityUsd: number;
  bsRatioMin: number;
  bsRatioMax: number;
  pumpBlockLo: number;
  pumpBlockHi: number;
};

function readQualityFilter(env: Env): QualityFilter {
  const num = (v: string | undefined, d: number): number => {
    const x = parseFloat(v ?? '');
    return Number.isFinite(x) ? x : d;
  };
  return {
    minLiquidityUsd: num(env.ENGINE_MIN_LIQUIDITY_USD, DEFAULT_MIN_LIQUIDITY_USD),
    bsRatioMin: num(env.ENGINE_BS_RATIO_MIN, DEFAULT_BS_RATIO_MIN),
    bsRatioMax: num(env.ENGINE_BS_RATIO_MAX, DEFAULT_BS_RATIO_MAX),
    pumpBlockLo: num(env.ENGINE_PUMP_BLOCK_LO, DEFAULT_PUMP_BLOCK_LO),
    pumpBlockHi: num(env.ENGINE_PUMP_BLOCK_HI, DEFAULT_PUMP_BLOCK_HI)
  };
}

function passesQualityFilter(snap: Snapshot | undefined, qf: QualityFilter): boolean {
  if (!snap) return false;
  if (!Number.isFinite(snap.liquidity_usd) || snap.liquidity_usd < qf.minLiquidityUsd) return false;
  // buys/sells ratio band — only check when we have a sells reading; sells=0 is treated as
  // missing data, not infinite ratio, because brand-new pools often haven't logged a sell yet.
  if (snap.sells_h1 > 0) {
    const ratio = snap.buys_h1 / snap.sells_h1;
    if (ratio < qf.bsRatioMin || ratio > qf.bsRatioMax) return false;
  }
  // Exhausted-pump band: tokens already up X-Y% in the last hour bleed in the next 15-60m.
  if (
    Number.isFinite(snap.price_change_h1) &&
    snap.price_change_h1 > qf.pumpBlockLo &&
    snap.price_change_h1 <= qf.pumpBlockHi
  ) {
    return false;
  }
  return true;
}

function isFlagOn(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function chunk<T>(arr: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function factorsObject(v: FactorVector): Record<string, number> {
  const o: Record<string, number> = {};
  FACTOR_KEYS.forEach((k, i) => (o[k] = v[i] ?? 0));
  return o;
}

async function persistTokensAndSnapshots(
  env: Env,
  pairs: Array<{
    baseToken: { address: string; name: string; symbol: string };
    pairAddress?: string;
    dexId?: string;
    info?: { imageUrl?: string };
  }>,
  snapByAddr: Map<string, Snapshot>,
  _now: number
): Promise<void> {
  const stmts: D1PreparedStatement[] = [];

  for (const p of pairs) {
    const a = p.baseToken.address;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO tokens (address, symbol, name, chain, pair_address, dex_id, image_url, last_updated)
         VALUES (?, ?, ?, 'solana', ?, ?, ?, unixepoch())
         ON CONFLICT(address) DO UPDATE SET
           symbol=excluded.symbol,
           name=excluded.name,
           pair_address=excluded.pair_address,
           dex_id=excluded.dex_id,
           image_url=COALESCE(excluded.image_url, tokens.image_url),
           last_updated=excluded.last_updated`
      ).bind(
        a,
        p.baseToken.symbol ?? null,
        p.baseToken.name ?? null,
        p.pairAddress ?? null,
        p.dexId ?? null,
        p.info?.imageUrl ?? null
      )
    );
  }

  for (const [, s] of snapByAddr) {
    stmts.push(
      env.DB.prepare(
        `INSERT OR REPLACE INTO token_snapshots
          (address, time, price_usd, price_native, market_cap, fdv, liquidity_usd,
           volume_m5, volume_h1, volume_h6, volume_h24,
           price_change_m5, price_change_h1, price_change_h6, price_change_h24,
           buys_h1, sells_h1)
         VALUES (?,?,?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?)`
      ).bind(
        s.address,
        s.time,
        s.price_usd,
        s.price_native,
        s.market_cap,
        s.fdv,
        s.liquidity_usd,
        s.volume_m5,
        s.volume_h1,
        s.volume_h6,
        s.volume_h24,
        s.price_change_m5,
        s.price_change_h1,
        s.price_change_h6,
        s.price_change_h24,
        s.buys_h1,
        s.sells_h1
      )
    );
  }

  if (stmts.length) await env.DB.batch(stmts);
}

/** Rolling windows for many tokens in one query, grouped by address in time order. */
async function loadRollingWindows(
  env: Env,
  addresses: string[],
  nowSec: number,
  minutes: number
): Promise<Map<string, Snapshot[]>> {
  const out = new Map<string, Snapshot[]>();
  if (!addresses.length) return out;
  const r = await env.DB.prepare(
    `SELECT s.* FROM json_each(?) a
     JOIN token_snapshots s ON s.address = a.value AND s.time >= ?
     ORDER BY s.address, s.time ASC`
  )
    .bind(JSON.stringify(addresses), nowSec - minutes * 60)
    .all<Snapshot>();
  for (const row of r.results ?? []) {
    const list = out.get(row.address);
    if (list) list.push(row);
    else out.set(row.address, [row]);
  }
  return out;
}

/** Latest score strictly before `nowSec` per address (one indexed lookup each, one round trip). */
async function loadPrevScores(env: Env, addresses: string[], nowSec: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!addresses.length) return out;
  const r = await env.DB.prepare(
    `SELECT a.value AS address,
            (SELECT score FROM signals s WHERE s.address = a.value AND s.time < ? ORDER BY s.time DESC LIMIT 1) AS score
     FROM json_each(?) a`
  )
    .bind(nowSec, JSON.stringify(addresses))
    .all<{ address: string; score: number | null }>();
  for (const row of r.results ?? []) if (row.score != null) out.set(row.address, row.score);
  return out;
}

/** Addresses that already had a FOMO spike in the last 30 minutes. */
async function loadFomoThrottled(env: Env, nowSec: number): Promise<Set<string>> {
  const r = await env.DB.prepare(
    `SELECT DISTINCT address FROM signal_events WHERE event_type = 'fomo_spike' AND time >= ?`
  )
    .bind(nowSec - 30 * 60)
    .all<{ address: string }>();
  return new Set((r.results ?? []).map((x) => x.address));
}

/**
 * 95th percentile of the stored `fomo` factor over ADAPTIVE_LOOKBACK_HOURS, floored at 1.5.
 * Computed in SQL (json_extract + ORDER BY/OFFSET) and cached in engine_state for
 * FOMO_TH_REFRESH_SEC, so the worker never parses thousands of factor rows.
 * Returns null when there are fewer than 30 samples.
 */
async function loadFomoThreshold(env: Env, nowSec: number): Promise<number | null> {
  const cached = await env.DB.prepare(`SELECT value, updated_at FROM engine_state WHERE key = 'fomo_th'`).first<{
    value: string;
    updated_at: number;
  }>();
  if (cached && nowSec - cached.updated_at < FOMO_TH_REFRESH_SEC) {
    const v = parseFloat(cached.value);
    return Number.isFinite(v) ? v : null;
  }

  const since = nowSec - ADAPTIVE_LOOKBACK_HOURS * 3600;
  const valid = `time >= ? AND json_type(factors_json, '$.fomo') IN ('real', 'integer')`;
  const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM signals WHERE ${valid}`)
    .bind(since)
    .first<{ n: number }>();
  const n = cnt?.n ?? 0;

  let th: number | null = null;
  if (n >= 30) {
    const row = await env.DB.prepare(
      `SELECT json_extract(factors_json, '$.fomo') AS v FROM signals WHERE ${valid}
       ORDER BY v ASC LIMIT 1 OFFSET ?`
    )
      .bind(since, Math.min(n - 1, Math.floor(FOMO_PERCENTILE * (n - 1))))
      .first<{ v: number }>();
    // Floor at 1.5 so we don't fire on noise in flat markets.
    if (row && Number.isFinite(row.v)) th = Math.max(1.5, row.v);
  }

  await env.DB.prepare(
    `INSERT INTO engine_state (key, value, updated_at) VALUES ('fomo_th', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(th == null ? 'null' : String(th), nowSec)
    .run();
  return th;
}

function eventStmt(
  env: Env,
  address: string,
  time: number,
  event_type: 'buy_trigger' | 'sell_trigger' | 'fomo_spike',
  score: number,
  prev_score: number | null,
  regime?: MarketRegime,
  threshold?: number
): D1PreparedStatement {
  const metadata =
    regime || threshold != null
      ? JSON.stringify({ regime: regime ?? null, threshold: threshold ?? null })
      : null;
  return env.DB.prepare(
    `INSERT INTO signal_events (address, time, event_type, score, prev_score, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(address, time, event_type, score, prev_score, metadata);
}

async function pruneOldData(env: Env, retentionHours: number): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - retentionHours * 3600;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM token_snapshots WHERE time < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM signals WHERE time < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM signal_events WHERE time < ?').bind(cutoff - 14 * 86400)
  ]);
}

async function loadStrategy(env: Env): Promise<Strategy> {
  if (env.STRATEGY_FORMULA_JSON) {
    try {
      const parsed = JSON.parse(env.STRATEGY_FORMULA_JSON) as {
        tokens?: number[];
        trained_at?: string;
        meta?: Record<string, unknown>;
      };
      if (Array.isArray(parsed.tokens) && parsed.tokens.length) {
        return {
          mode: 'formula',
          formula: { tokens: parsed.tokens, trained_at: parsed.trained_at, meta: parsed.meta }
        };
      }
      // Walk-forward harness emits tokens=[] with meta.fallback_weights; we still
      // need to surface the meta so the engine can use the trained weights.
      if (parsed.meta) {
        return {
          mode: 'formula',
          formula: { tokens: [], trained_at: parsed.trained_at, meta: parsed.meta }
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { mode: 'fallback', formula: null };
}

/**
 * Extract trained BUY / SELL thresholds from STRATEGY_FORMULA_JSON.meta.thresholds.
 * Returns undefined if no trained pair is present — callers fall back to
 * adaptive percentiles or fixed env defaults.
 */
function extractThresholds(strategy: Strategy): { buy: number; sell: number } | undefined {
  if (strategy.mode !== 'formula') return undefined;
  const raw = strategy.formula?.meta?.['thresholds'];
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const buy = typeof obj.buy === 'number' && Number.isFinite(obj.buy) ? obj.buy : null;
  const sell = typeof obj.sell === 'number' && Number.isFinite(obj.sell) ? obj.sell : null;
  if (buy == null || sell == null || buy <= sell) return undefined;
  return { buy, sell };
}

/**
 * Extract trained fallback weights from STRATEGY_FORMULA_JSON.meta.fallback_weights
 * (written by research/backtest_walk_forward.py). Returns undefined if no
 * trained weights are present — callers fall back to DEFAULT_FALLBACK_WEIGHTS.
 */
function extractWeights(strategy: Strategy): FallbackWeights | undefined {
  if (strategy.mode !== 'formula') return undefined;
  const raw = strategy.formula?.meta?.['fallback_weights'];
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of Object.keys(DEFAULT_FALLBACK_WEIGHTS)) {
    const v = obj[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
    out[k] = v;
  }
  return out as unknown as FallbackWeights;
}
