/**
 * 12-dimensional factor vector for FOMOMETER, computed from a rolling window of
 * DexScreener snapshots (1-min cadence).
 *
 * Adapted from AlphaGPT's `model_core/factors.py`. Where the original used
 * OHLC tensors, we substitute DexScreener-native fields (priceChange, txns,
 * volume aggregates) plus our own time-series of `price_usd`.
 *
 * Design notes:
 *  - All inputs and outputs are plain numbers (no tensor library) — we work
 *    on a single token's recent N snapshots.
 *  - Numerically stable: every divisor adds an `EPS` to avoid NaN/Inf.
 *  - Returns 12 finite numbers; callers should treat NaN as 0.
 */

import type { FactorVector, Snapshot } from '../types';

export const EPS = 1e-9;

const MA_WINDOW_MIN = 20;
const RSI_WINDOW = 14;
const VOL_CLUSTER_WINDOW = 10;
const MOM_WINDOW = 5;

export type FactorWindow = ReadonlyArray<Snapshot>; // chronological order, last is most recent

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function safeDiv(a: number, b: number): number {
  return a / (Math.abs(b) < EPS ? (b < 0 ? -EPS : EPS) : b);
}

function safeLog(x: number): number {
  return Math.log(Math.max(EPS, x));
}

function tanh(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e = Math.exp(2 * x);
  return (e - 1) / (e + 1);
}

function sum(arr: ReadonlyArray<number>): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

function mean(arr: ReadonlyArray<number>): number {
  return arr.length === 0 ? 0 : sum(arr) / arr.length;
}

function std(arr: ReadonlyArray<number>): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let v = 0;
  for (const x of arr) v += (x - m) ** 2;
  return Math.sqrt(v / arr.length);
}

/** Compute log returns for adjacent prices in `window`, length N -> length N-1 (no leading 0). */
function logReturns(prices: ReadonlyArray<number>): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const p1 = prices[i] ?? 0;
    const p0 = prices[i - 1] ?? 0;
    out.push(safeLog(p1) - safeLog(p0));
  }
  return out;
}

/**
 * Compute the 12-factor vector from a window of snapshots.
 * Returns zeros for factors that cannot be derived from too-short window.
 */
export function computeFactors(window: FactorWindow): FactorVector {
  const n = window.length;
  const last = n > 0 ? window[n - 1] : null;
  if (!last) return Array(12).fill(0) as unknown as FactorVector;

  const prices = window.map((s) => s.price_usd);

  // 1. ret — log return between last 2 snapshots.
  const ret =
    n >= 2
      ? safeLog(prices[n - 1] ?? 0) - safeLog(prices[n - 2] ?? 0)
      : 0;

  // 2. liq_score — clamp(liq / fdv * 4, 0, 1). FDV may be null on some pairs.
  const liq_score = (() => {
    const liq = last.liquidity_usd ?? 0;
    const fdv = last.fdv ?? 0;
    if (!fdv || fdv < 1) return 0;
    return clamp((liq / fdv) * 4, 0, 1);
  })();

  // 3. pressure — buy/sell imbalance over last hour, tanh'd for boundedness.
  const pressure = (() => {
    const b = last.buys_h1 ?? 0;
    const s = last.sells_h1 ?? 0;
    if (b + s < 1) return 0;
    return tanh(((b - s) / (b + s)) * 3);
  })();

  // 4. fomo — short-term volume acceleration.
  const fomo = (() => {
    const v5 = last.volume_m5 ?? 0;
    const v1h = last.volume_h1 ?? 0;
    if (v1h < 1) return 0;
    return clamp((v5 * 12 - v1h) / (v1h + 1), -5, 5);
  })();

  // 5. dev — deviation from 20-min moving average.
  const dev = (() => {
    if (n < 2) return 0;
    const ma = mean(prices.slice(Math.max(0, n - MA_WINDOW_MIN)));
    return safeDiv(last.price_usd - ma, ma);
  })();

  // 6. log_vol — log(1 + volume_h1)
  const log_vol = Math.log1p(Math.max(0, last.volume_h1 ?? 0));

  // 7. vol_cluster — rolling std of returns over last 10 minutes.
  const vol_cluster = (() => {
    if (n < 3) return 0;
    const recent = prices.slice(Math.max(0, n - VOL_CLUSTER_WINDOW - 1));
    return std(logReturns(recent));
  })();

  // 8. momentum_rev — sign flip of cumulative return on a 5-min window vs prior 5-min.
  const momentum_rev = (() => {
    if (n < MOM_WINDOW * 2 + 1) return 0;
    const r = logReturns(prices.slice(n - (MOM_WINDOW * 2 + 1)));
    if (r.length < MOM_WINDOW * 2) return 0;
    const recent = sum(r.slice(-MOM_WINDOW));
    const prev = sum(r.slice(-MOM_WINDOW * 2, -MOM_WINDOW));
    return recent * prev < 0 ? 1 : 0;
  })();

  // 9. rel_strength — RSI-14 on 1-min returns, normalized to [-1, 1]
  const rel_strength = (() => {
    if (n < RSI_WINDOW + 1) return 0;
    const r = logReturns(prices.slice(n - RSI_WINDOW - 1));
    let gains = 0;
    let losses = 0;
    for (const v of r) {
      if (v > 0) gains += v;
      else losses -= v;
    }
    const avgG = gains / RSI_WINDOW;
    const avgL = losses / RSI_WINDOW;
    const rs = (avgG + EPS) / (avgL + EPS);
    const rsi = 100 - 100 / (1 + rs);
    return (rsi - 50) / 50;
  })();

  // 10. hl_range — absolute hourly price change as proxy for high-low range.
  const hl_range = Math.abs(last.price_change_h1 ?? 0) / 100; // percentage -> ratio

  // 11. close_pos — position of current price within last-hour high/low (built from time-series).
  const close_pos = (() => {
    if (n < 2) return 0.5;
    const hourly = prices.slice(Math.max(0, n - 60));
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of hourly) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (hi - lo < EPS) return 0.5;
    return clamp((last.price_usd - lo) / (hi - lo), 0, 1);
  })();

  // 12. vol_trend — short vs long volume ratio.
  const vol_trend = (() => {
    const v1 = last.volume_h1 ?? 0;
    const v6 = last.volume_h6 ?? 0;
    if (v6 < 1) return 0;
    return clamp((v1 - v6 / 6) / (v6 / 6 + 1), -5, 5);
  })();

  const out: FactorVector = [
    ret,
    liq_score,
    pressure,
    fomo,
    dev,
    log_vol,
    vol_cluster,
    momentum_rev,
    rel_strength,
    hl_range,
    close_pos,
    vol_trend
  ] as unknown as FactorVector;

  // Sanitize NaN/Inf
  return out.map((v) => (Number.isFinite(v) ? v : 0)) as unknown as FactorVector;
}

/**
 * Sigmoid for fallback aggregation.
 */
export function sigmoid(x: number): number {
  if (x > 30) return 1;
  if (x < -30) return 0;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Robust normalization (median + MAD) used by AlphaGPT pre-VM.
 * For the per-token compute path we don't have a population; we apply a soft
 * clamp instead to keep values bounded for the StackVM operators.
 */
export function softClamp(x: number, range = 5): number {
  if (!Number.isFinite(x)) return 0;
  return clamp(x, -range, range);
}

/**
 * Per-feature population statistic computed across the universe at a single
 * timestep (cross-sectional). Used to z-score raw factors so each token is
 * scored relative to the rest of the market — kills false-positives when the
 * whole market moves together (panic / rally).
 */
export type FactorStats = ReadonlyArray<{ mean: number; std: number }>;

export function computePopulationStats(vectors: ReadonlyArray<FactorVector>): FactorStats {
  const dim = 12;
  const out: Array<{ mean: number; std: number }> = [];
  for (let i = 0; i < dim; i++) {
    let s = 0;
    let n = 0;
    for (const v of vectors) {
      const x = v[i];
      if (typeof x === 'number' && Number.isFinite(x)) {
        s += x;
        n++;
      }
    }
    const m = n > 0 ? s / n : 0;
    let v2 = 0;
    for (const v of vectors) {
      const x = v[i];
      if (typeof x === 'number' && Number.isFinite(x)) v2 += (x - m) ** 2;
    }
    const sd = n > 1 ? Math.sqrt(v2 / n) : 0;
    out.push({ mean: m, std: sd });
  }
  return out;
}

/**
 * Z-score every factor against population stats and soft-clamp to ±5.
 * If std is ~0 (degenerate population), pass the raw value through clamp.
 */
export function normalizeByPopulation(
  factors: FactorVector,
  stats: FactorStats,
  range = 5
): FactorVector {
  const out = factors.map((v, i) => {
    const s = stats[i];
    if (!s || s.std < EPS) return softClamp(v ?? 0, range);
    return softClamp((v - s.mean) / s.std, range);
  }) as unknown as number[];
  return out as unknown as FactorVector;
}
