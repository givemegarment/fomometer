/**
 * FOMOMETER — Engine cron worker
 * Runs every minute. Steps:
 *  1. Determine target token universe = Top-N DexScreener boosted Solana tokens.
 *     Tokens scored in the last 4 h 10 m but no longer boosted are snapshotted too (not
 *     scored), so the labeler can price events and baseline samples after they leave.
 *  2. Snapshot via DexScreener (batches of 30).
 *  3. Persist tokens + token_snapshots.
 *  4. Compute the 12-factor vector per token on a rolling window (one D1 query for all tokens).
 *  5. Run StackVM (or fallback) → score, factors_json. Write to signals.
 *  6. Detect transitions (BUY/SELL/FOMO_SPIKE) → signal_events. All writes go in one D1 batch.
 *     pump.fun graduates outside the boosted list are scored the same way in shadow (./shadow.ts):
 *     shadow_signals and shadow_events only, never in the population, thresholds or signals.
 *
 * CPU budget: the worker runs under a tight per-invocation CPU limit, so D1 round
 * trips are batched and nothing parses large JSON in the worker.
 *  7. Prune old data per retention.
 */
import { DsRelay, RELAY_REGIONS } from './relay';
import { loadShadow, pruneShadow, shadowUpdates, SCREEN_EVERY_SEC } from './shadow';
import { paperStatements } from './paper';
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
  /** Quality prefilter — minimum hours since the engine first saw the token. */
  ENGINE_MIN_TOKEN_AGE_H?: string;
  /** Mints never scored or tracked, comma-separated: $FMTR, FOMOMETER's own token (whitepaper, "Own token"). */
  ENGINE_EXCLUDE_MINTS?: string;
  /** Durable Object relays that fetch DexScreener from other regions (./relay.ts). */
  DS_RELAY: DurableObjectNamespace;
}

export { DsRelay };

/** Three relay regions per run, in random order, so a refused request leaves from elsewhere. */
function relays(env: Env) {
  const regions = [...RELAY_REGIONS].sort(() => Math.random() - 0.5).slice(0, 3);
  return regions.map((region) => (url: string) =>
    env.DS_RELAY.get(env.DS_RELAY.idFromName(region), { locationHint: region }).fetch(
      `https://relay/?u=${encodeURIComponent(url)}`
    ) as unknown as Promise<Response>
  );
}

const ROLLING_WINDOW_MIN = 90;       // factors look back ≤ 90 minutes (was 60)
const DEFAULT_WARM_UP_MIN = 10;      // need ≥ N snapshots before MA/RSI factors are trusted (DexScreener trending rotates fast, so 10 is a realistic floor)
const ADAPTIVE_LOOKBACK_HOURS = 6;   // window over which BUY/SELL percentiles are computed
const FOMO_FACTOR_INDEX = 3;         // index of `fomo` in FactorVector
const FOMO_FALLBACK_THRESHOLD = 2.5; // used only when adaptive percentile is unavailable
const FOMO_PERCENTILE = 0.95;        // FOMO spike fires above 95th percentile of recent fomo factor
const FOMO_TH_REFRESH_SEC = 30 * 60; // adaptive FOMO threshold is recomputed at most every 30 min
const FOMO_COOLDOWN_SEC = 30 * 60;   // at most one volume burst per token in this window
// At most one BUY per token per 4 h, the horizon each BUY is priced at. Scores flap around the
// threshold: one token had 20 BUYs in 21 h, two of them identical 4 minutes apart.
const BUY_COOLDOWN_SEC = 4 * 3600;
// Keep snapshotting a token this long after it was last scored: the 4 h horizon plus the
// labeler tolerance. Covers every event and every baseline sample alike.
const POST_SCORE_TRACK_SEC = 4 * 3600 + 10 * 60;
const POST_SCORE_TRACK_MAX = 60;     // bound on extra tokens per run
// DexScreener answers the boost lists with HTTP 429 from Cloudflare (shared egress), for 4 to 27
// minutes an hour on 15 Oct and for streaks longer than that. Boosts change over hours, so the
// list is fetched at most every UNIVERSE_REFRESH_SEC (with retries in the client), and the last good list is
// used for up to UNIVERSE_CACHE_MAX_AGE_SEC. Prices still come every minute from the pairs
// endpoint, which has its own, higher limit.
const UNIVERSE_REFRESH_SEC = 3 * 60;
const UNIVERSE_CACHE_MAX_AGE_SEC = 60 * 60;

// Quality prefilter defaults — empirically validated against 609 labeled events.
// Population stats: liq<$25k → 37% hit, liq≥$25k → 53-58% hit; b/s≥3.0 → 37% hit/-13.7% avg;
// price_change_h1 ∈ (50,100]% → 17% hit/-5.9% avg. See research/ for the trainer.
const DEFAULT_MIN_LIQUIDITY_USD = 25000;
const DEFAULT_BS_RATIO_MIN = 0.8;
const DEFAULT_BS_RATIO_MAX = 3.0;
const DEFAULT_PUMP_BLOCK_LO = 50;
const DEFAULT_PUMP_BLOCK_HI = 100;
// Fitted 2026-10-15 on outcomes May–Aug (age grid 0–168 h, best trimmed mean of the 4 h return),
// checked on Sep–Oct: BUY 4 h median −6.8 % → −3.5 % after a 3 % round-trip cost, win 29 % → 36 %.
// Fewer losses, not an edge: still negative after costs. Age = time since tokens.first_seen.
const DEFAULT_MIN_TOKEN_AGE_H = 48;

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

  const ds = new DexScreenerClient(env.DEXSCREENER_BASE_URL, relays(env));

  // 1. Universe = boosted top-N (the site's watchlist lives in the browser, not in D1).
  const cached = await env.DB.prepare(`SELECT value, updated_at FROM engine_state WHERE key = 'last_universe'`).first<{
    value: string;
    updated_at: number;
  }>();
  const cacheAge = cached ? now - cached.updated_at : Infinity;
  let trending: Array<{ tokenAddress: string }> = [];
  // Retries with backoff live in the client (DexScreenerClient.getJson).
  if (cacheAge >= UNIVERSE_REFRESH_SEC) trending = await ds.getTrendingSolana();
  const excluded = new Set((env.ENGINE_EXCLUDE_MINTS ?? '').split(',').map((a) => a.trim()).filter(Boolean));
  let universe = Array.from(new Set(trending.map((t) => t.tokenAddress).filter((a) => !excluded.has(a)).slice(0, topN)));
  let universeSource: 'live' | 'cache' = 'live';
  if (universe.length > 0) {
    await env.DB.prepare(
      `INSERT INTO engine_state (key, value, updated_at) VALUES ('last_universe', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
      .bind(JSON.stringify(universe), now)
      .run();
  } else {
    if (!cached || cacheAge > UNIVERSE_CACHE_MAX_AGE_SEC) {
      console.log(`engine: no universe (${ds.errors.join(', ') || 'empty lists'}), skipping`);
      return;
    }
    universe = (JSON.parse(cached.value) as string[]).filter((a) => !excluded.has(a));
    universeSource = 'cache';
    // Logged only when a refresh was due and failed, not on the minutes in between.
    if (cacheAge >= UNIVERSE_REFRESH_SEC) console.log(`engine: boosts unavailable (${ds.errors.join(', ')}), using the list from ${cacheAge}s ago`);
  }
  const universeSet = new Set(universe);
  // Tokens scored within the last 4 h 10 m but no longer boosted: price only, no score.
  const lastScored = await loadLastScored(env, now);
  const trackOnly = [...lastScored.entries()]
    .filter(([a]) => !universeSet.has(a))
    .sort((x, y) => y[1] - x[1])
    .slice(0, POST_SCORE_TRACK_MAX)
    .map(([a]) => a);

  // 1b. Shadow: active pump.fun graduates outside the lists above, fetched in the same batches;
  // graduates due for their one screen go in batches of their own and are not stored.
  const shadowPlan = await loadShadow(env.DB, now, now % SCREEN_EVERY_SEC < 60);
  const live = new Set([...universe, ...trackOnly]);
  const shadowAddrs = [...new Set([...shadowPlan.active.keys(), ...shadowPlan.postEvent])].filter((a) => !live.has(a) && !excluded.has(a));
  const dueAddrs = shadowPlan.due.filter((a) => !live.has(a) && !shadowAddrs.includes(a));

  // 2. Snapshot in batches of 30.
  const [pairs, dueParts] = await Promise.all([
    Promise.all(chunk([...universe, ...trackOnly, ...shadowAddrs], 30).map((c) => ds.getTokensBatch(c))).then((parts) => parts.flat()),
    Promise.all(chunk(dueAddrs, 30).map((c) => ds.getTokensBatch(c).then((p) => ({ c, p }))))
  ]);

  // Build snapshots map keyed by address.
  const snapByAddr = new Map<string, Snapshot>();
  for (const p of pairs) {
    snapByAddr.set(p.baseToken.address, pairToSnapshot(p, now));
  }

  if (snapByAddr.size === 0) {
    console.log(`engine: no pairs returned (${ds.errors.join(', ') || 'empty'})`);
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

  const scoredAddrs = [...snapByAddr.keys()].filter((a) => universeSet.has(a));
  const shadowScoredAddrs = [...shadowPlan.active.keys()].filter((a) => !live.has(a) && snapByAddr.has(a));
  const windows = await loadRollingWindows(env, [...scoredAddrs, ...shadowScoredAddrs], now, ROLLING_WINDOW_MIN);
  const computed: Computed[] = [];
  for (const addr of scoredAddrs) {
    const snap = snapByAddr.get(addr)!;
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
  const popStats = useNorm && computed.length >= 5 ? computePopulationStats(computed.map((c) => c.factorsRaw)) : null;
  if (popStats) {
    for (const c of computed) c.factorsScored = normalizeByPopulation(c.factorsRaw, popStats);
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

  // 5–6. Persist signals and emit transition events. Reads first (previous scores, burst and
  // BUY cooldowns), then every write in a single batch.
  const firstSeen = await loadFirstSeen(env, scored.filter((c) => c.warm).map((c) => c.addr));
  const eligible = scored.filter(
    (c) => c.warm && passesQualityFilter(snapByAddr.get(c.addr), firstSeen.get(c.addr), now, qf)
  );
  const filteredOut = scored.filter((c) => c.warm).length - eligible.length;
  const eligibleAddrs = eligible.map((c) => c.addr);
  const prevScores = await loadPrevScores(env, eligibleAddrs, now);
  const { fomoThrottled, buyCooldown } = await loadRecentEvents(env, now);

  let buyTriggers = 0;
  let sellTriggers = 0;
  let fomoSpikes = 0;
  const flags = new Map<string, { buy: boolean; sell: boolean }>();
  const eventStmts: D1PreparedStatement[] = [];
  const th = { buy: buyTh, sell: sellTh, fomo: fomoTh };
  for (const c of eligible) {
    const { addr, score } = c;
    const prevScore = prevScores.get(addr) ?? null;
    const ev = { regime, scored: c.factorsScored, raw: c.factorsRaw };
    const cool = { buy: buyCooldown.has(addr), fomo: fomoThrottled.has(addr) };
    for (const e of detectEvents(score, prevScore, c.factorsRaw[FOMO_FACTOR_INDEX] ?? 0, th, cool)) {
      if (e.type === 'buy_trigger') {
        buyTriggers++;
        flags.set(addr, { buy: true, sell: false });
      } else if (e.type === 'sell_trigger') {
        sellTriggers++;
        flags.set(addr, { buy: false, sell: true });
      } else fomoSpikes++;
      eventStmts.push(eventStmt(env, addr, now, e.type, score, prevScore, { ...ev, threshold: e.threshold }));
    }
  }

  // 5b. Shadow graduates: the live population's normalization, regime, thresholds and quality
  // filter (age from the migration), their own previous scores and cooldowns.
  const shadowStmts: D1PreparedStatement[] = [];
  let shadowEvents = 0;
  if (shadowScoredAddrs.length) {
    const [shadowPrev, shadowRecent] = await Promise.all([
      loadPrevScores(env, shadowScoredAddrs, now, 'shadow_signals'),
      loadRecentEvents(env, now, 'shadow_events')
    ]);
    for (const addr of shadowScoredAddrs) {
      const window = windows.get(addr) ?? [];
      if (window.length === 0) window.push(snapByAddr.get(addr)!);
      const raw = computeFactors(window);
      const vec = popStats ? normalizeByPopulation(raw, popStats) : raw;
      const first = computeScore(vec, strategy, { weights: trainedWeights });
      const score =
        useRegime && regime && regime !== 'neutral' && first.mode === 'fallback'
          ? computeScore(vec, strategy, { regime, weights: trainedWeights }).score
          : first.score;
      const fomoRaw = raw[FOMO_FACTOR_INDEX] ?? 0;
      shadowStmts.push(
        env.DB.prepare(`INSERT OR REPLACE INTO shadow_signals (address, time, score, fomo_raw) VALUES (?, ?, ?, ?)`).bind(
          addr,
          now,
          score,
          raw[FOMO_FACTOR_INDEX] ?? null
        )
      );
      if (window.length < warmUpMin || !passesQualityFilter(snapByAddr.get(addr), shadowPlan.active.get(addr), now, qf)) continue;
      const prevScore = shadowPrev.get(addr) ?? null;
      const cool = { buy: shadowRecent.buyCooldown.has(addr), fomo: shadowRecent.fomoThrottled.has(addr) };
      for (const e of detectEvents(score, prevScore, fomoRaw, th, cool)) {
        shadowEvents++;
        shadowStmts.push(
          eventStmt(env, addr, now, e.type, score, prevScore, { regime, scored: vec, raw, threshold: e.threshold }, 'shadow_events')
        );
      }
    }
  }
  const liquidity = new Map<string, number>();
  for (const p of [...pairs, ...dueParts.flatMap((d) => d.p)]) liquidity.set(p.baseToken.address, p.liquidity?.usd ?? 0);
  const answered = new Set(dueParts.filter((d) => d.p.length > 0).flatMap((d) => d.c));
  for (const a of shadowPlan.due) if (live.has(a) && pairs.length > 0) answered.add(a);
  const screen = shadowUpdates(env.DB, now, shadowPlan, liquidity, qf.minLiquidityUsd, answered);

  // Signal rows for every scored token (the *scored* vector — what the engine actually used),
  // then events. Warm-up / quality gates only suppress events, never signal rows.
  const signalStmts = scored.map((c) => {
    const f = flags.get(c.addr);
    return env.DB.prepare(
      `INSERT OR REPLACE INTO signals (address, time, score, factors_json, is_buy, is_sell, fomo_raw)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      c.addr,
      now,
      c.score,
      JSON.stringify(factorsObject(c.factorsScored)),
      f?.buy ? 1 : 0,
      f?.sell ? 1 : 0,
      c.factorsRaw[FOMO_FACTOR_INDEX] ?? null
    );
  });
  for (const c of scored) lastScored.set(c.addr, now);
  const lastScoredStmt = env.DB.prepare(
    `INSERT INTO engine_state (key, value, updated_at) VALUES ('last_scored', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(JSON.stringify(Object.fromEntries(lastScored)), now);
  await env.DB.batch([...signalStmts, ...eventStmts, lastScoredStmt, ...shadowStmts, ...screen.stmts]);

  // 6b. Paper portfolios (./paper.ts): scored tokens only, after this run's snapshots are stored.
  const prices = new Map([...snapByAddr].map(([a, sn]) => [a, sn.price_usd]));
  const paper = await paperStatements(env.DB, now, scored.map((c) => snapByAddr.get(c.addr)!), prices);
  if (paper.stmts.length) await env.DB.batch(paper.stmts);

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
        universe_source: universeSource,
        snapshots: snapByAddr.size,
        tracked_after_list: trackOnly.length,
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
        quality_filter: qf,
        shadow: {
          scored: shadowScoredAddrs.length,
          fetched: shadowAddrs.length,
          screened: shadowPlan.due.length,
          activated: screen.activated.length,
          events: shadowEvents
        },
        paper: { opened: paper.opened, closed: paper.closed, exits: paper.exits }
      }),
      now
    )
    .run();

  console.log(
    `engine cycle: ${snapByAddr.size} tokens, +${buyTriggers}b/${sellTriggers}s/${fomoSpikes}f (filt ${filteredOut}), regime=${regime ?? 'off'}, th=${buyTh.toFixed(2)}/${sellTh.toFixed(2)}, universe=${universeSource}, shadow=${shadowScoredAddrs.length} +${shadowEvents}e (screened ${shadowPlan.due.length}, +${screen.activated.length}), paper +${paper.opened}/-${paper.closed} (${paper.exits} exits), ds retries=${ds.retries} relayed=${ds.relayed}, ${Date.now() - t0}ms`
  );
}

type QualityFilter = {
  minLiquidityUsd: number;
  bsRatioMin: number;
  bsRatioMax: number;
  pumpBlockLo: number;
  pumpBlockHi: number;
  minTokenAgeH: number;
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
    pumpBlockHi: num(env.ENGINE_PUMP_BLOCK_HI, DEFAULT_PUMP_BLOCK_HI),
    minTokenAgeH: num(env.ENGINE_MIN_TOKEN_AGE_H, DEFAULT_MIN_TOKEN_AGE_H)
  };
}

function passesQualityFilter(
  snap: Snapshot | undefined,
  firstSeen: number | undefined,
  nowSec: number,
  qf: QualityFilter
): boolean {
  if (!snap) return false;
  // Young tokens: BUY on tokens seen for under an hour lost a median 43 % in 4 h.
  if (qf.minTokenAgeH > 0 && (firstSeen == null || nowSec - firstSeen < qf.minTokenAgeH * 3600)) return false;
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

/**
 * Address → time it was last scored, for tokens scored within POST_SCORE_TRACK_SEC.
 * Kept in engine_state ('last_scored', a small JSON object) so the engine does not scan
 * signals every minute. Older entries are dropped here and on the next write.
 */
async function loadLastScored(env: Env, nowSec: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const row = await env.DB.prepare(`SELECT value FROM engine_state WHERE key = 'last_scored'`).first<{ value: string }>();
  if (!row?.value) return out;
  try {
    for (const [a, t] of Object.entries(JSON.parse(row.value) as Record<string, unknown>)) {
      if (typeof t === 'number' && nowSec - t <= POST_SCORE_TRACK_SEC) out.set(a, t);
    }
  } catch {
    /* malformed: start empty */
  }
  return out;
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

/** When the engine first saw each token (tokens.first_seen, never overwritten). */
async function loadFirstSeen(env: Env, addresses: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!addresses.length) return out;
  const r = await env.DB.prepare(
    `SELECT t.address, t.first_seen FROM json_each(?) a JOIN tokens t ON t.address = a.value`
  )
    .bind(JSON.stringify(addresses))
    .all<{ address: string; first_seen: number }>();
  for (const row of r.results ?? []) out.set(row.address, row.first_seen);
  return out;
}

/** Latest score strictly before `nowSec` per address (one indexed lookup each, one round trip). */
async function loadPrevScores(
  env: Env,
  addresses: string[],
  nowSec: number,
  table: 'signals' | 'shadow_signals' = 'signals'
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!addresses.length) return out;
  const r = await env.DB.prepare(
    `SELECT a.value AS address,
            (SELECT score FROM ${table} s WHERE s.address = a.value AND s.time < ? ORDER BY s.time DESC LIMIT 1) AS score
     FROM json_each(?) a`
  )
    .bind(nowSec, JSON.stringify(addresses))
    .all<{ address: string; score: number | null }>();
  for (const row of r.results ?? []) if (row.score != null) out.set(row.address, row.score);
  return out;
}

/**
 * Addresses in cooldown: a volume burst in the last FOMO_COOLDOWN_SEC, a BUY in the last
 * BUY_COOLDOWN_SEC. Reads every event of the window by time and filters the type here: with
 * the type in SQL the planner walked a whole index (≈ 1,900 rows a minute; by time ≈ 30 for 4 h).
 */
async function loadRecentEvents(
  env: Env,
  nowSec: number,
  table: 'signal_events' | 'shadow_events' = 'signal_events'
): Promise<{ fomoThrottled: Set<string>; buyCooldown: Set<string> }> {
  const r = await env.DB.prepare(`SELECT address, event_type, time FROM ${table} WHERE time >= ?`)
    .bind(nowSec - Math.max(FOMO_COOLDOWN_SEC, BUY_COOLDOWN_SEC))
    .all<{ address: string; event_type: string; time: number }>();
  const rows = r.results ?? [];
  return {
    fomoThrottled: new Set(rows.filter((x) => x.event_type === 'fomo_spike' && x.time >= nowSec - FOMO_COOLDOWN_SEC).map((x) => x.address)),
    buyCooldown: new Set(rows.filter((x) => x.event_type === 'buy_trigger' && x.time >= nowSec - BUY_COOLDOWN_SEC).map((x) => x.address))
  };
}

/**
 * 95th percentile of the raw `fomo` factor (signals.fomo_raw) over ADAPTIVE_LOOKBACK_HOURS,
 * floored at 1.5. Same scale as the value it is compared with (factorsRaw). Computed in SQL
 * and cached in engine_state for FOMO_TH_REFRESH_SEC.
 * Returns null when there are fewer than 30 samples.
 */
async function loadFomoThreshold(env: Env, nowSec: number): Promise<number | null> {
  const cached = await env.DB.prepare(`SELECT value, updated_at FROM engine_state WHERE key = 'fomo_th_raw'`).first<{
    value: string;
    updated_at: number;
  }>();
  if (cached && nowSec - cached.updated_at < FOMO_TH_REFRESH_SEC) {
    const v = parseFloat(cached.value);
    return Number.isFinite(v) ? v : null;
  }

  const since = nowSec - ADAPTIVE_LOOKBACK_HOURS * 3600;
  const valid = `time >= ? AND fomo_raw IS NOT NULL`;
  const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM signals WHERE ${valid}`)
    .bind(since)
    .first<{ n: number }>();
  const n = cnt?.n ?? 0;

  let th: number | null = null;
  if (n >= 30) {
    const row = await env.DB.prepare(
      `SELECT fomo_raw AS v FROM signals WHERE ${valid}
       ORDER BY v ASC LIMIT 1 OFFSET ?`
    )
      .bind(since, Math.min(n - 1, Math.floor(FOMO_PERCENTILE * (n - 1))))
      .first<{ v: number }>();
    // Floor at 1.5 so we don't fire on noise in flat markets.
    if (row && Number.isFinite(row.v)) th = Math.max(1.5, row.v);
  }

  await env.DB.prepare(
    `INSERT INTO engine_state (key, value, updated_at) VALUES ('fomo_th_raw', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(th == null ? 'null' : String(th), nowSec)
    .run();
  return th;
}

/**
 * Event row. metadata_json keeps both factor vectors so the labeler can copy them into
 * signal_outcomes, which is never pruned: `factors.scored` is what the score used,
 * `factors.raw` is before cross-sectional normalization.
 */
function eventStmt(
  env: Env,
  address: string,
  time: number,
  event_type: EventType,
  score: number,
  prev_score: number | null,
  ev: { regime?: MarketRegime; threshold: number; scored: FactorVector; raw: FactorVector },
  table: 'signal_events' | 'shadow_events' = 'signal_events'
): D1PreparedStatement {
  const metadata = JSON.stringify({
    regime: ev.regime ?? null,
    threshold: ev.threshold,
    factors: { scored: factorsObject(ev.scored), raw: factorsObject(ev.raw) }
  });
  return env.DB.prepare(
    `INSERT INTO ${table} (address, time, event_type, score, prev_score, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(address, time, event_type, score, prev_score, metadata);
}

type EventType = 'buy_trigger' | 'sell_trigger' | 'fomo_spike';

/**
 * Transitions for one token this run. BUY: the score crossed the BUY threshold upwards, outside
 * the BUY cooldown. SELL: from at or above the BUY threshold to at or under the SELL one. Volume
 * burst: the raw factor (magnitude, not normalized) over its percentile, outside the burst cooldown.
 */
function detectEvents(
  score: number,
  prevScore: number | null,
  fomoRaw: number,
  th: { buy: number; sell: number; fomo: number },
  cool: { buy: boolean; fomo: boolean }
): Array<{ type: EventType; threshold: number }> {
  const out: Array<{ type: EventType; threshold: number }> = [];
  if (prevScore != null && prevScore < th.buy && score >= th.buy && !cool.buy) out.push({ type: 'buy_trigger', threshold: th.buy });
  else if (prevScore != null && prevScore >= th.buy && score <= th.sell) out.push({ type: 'sell_trigger', threshold: th.sell });
  if (fomoRaw > th.fomo && !cool.fomo) out.push({ type: 'fomo_spike', threshold: th.fomo });
  return out;
}

async function pruneOldData(env: Env, retentionHours: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - retentionHours * 3600;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM token_snapshots WHERE time < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM signals WHERE time < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM signal_events WHERE time < ?').bind(cutoff - 14 * 86400),
    ...pruneShadow(env.DB, now, cutoff)
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
