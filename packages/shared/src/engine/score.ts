/**
 * Top-level score computation: runs StackVM if a formula is available, else
 * uses the FOMO-weighted fallback described in the roadmap.
 */
import type { FactorVector, Strategy } from '../types';
import { sigmoid } from './factors';
import { StackVM } from './vm';
import type { OpContext } from './ops';

export type MarketRegime = 'bull' | 'bear' | 'panic' | 'neutral';

export type ScoreResult = {
  score: number; // 0..1
  mode: 'formula' | 'fallback';
  raw: number;
  regime?: MarketRegime;
};

const vm = new StackVM();

export type FallbackWeights = {
  fomo: number;
  pressure: number;
  momentum_rev: number;
  liq_score: number;
  vol_trend: number;
  rel_strength: number;
  dev: number;
};

/** Default fallback weights — fomo-heavy. Override via FallbackWeights. */
export const DEFAULT_FALLBACK_WEIGHTS: FallbackWeights = {
  fomo: 0.30,
  pressure: 0.20,
  momentum_rev: 0.15,
  liq_score: 0.10,
  vol_trend: 0.10,
  rel_strength: 0.10,
  dev: 0.05
};

/**
 * Fallback scoring: weighted-sum on the 12-factor vector, sigmoid-squashed
 * to [0,1]. Weights are tunable so Optuna / walk-forward can refit them
 * without changing the engine code.
 *
 * factors order (see types.FACTOR_KEYS):
 *  0 ret, 1 liq_score, 2 pressure, 3 fomo, 4 dev, 5 log_vol,
 *  6 vol_cluster, 7 momentum_rev, 8 rel_strength, 9 hl_range, 10 close_pos, 11 vol_trend
 */
export function fallbackScore(
  factors: FactorVector,
  weights: FallbackWeights = DEFAULT_FALLBACK_WEIGHTS
): number {
  const f = factors;
  const x =
    weights.fomo * (f[3] ?? 0) +
    weights.pressure * (f[2] ?? 0) +
    weights.momentum_rev * (f[7] ?? 0) +
    weights.liq_score * (f[1] ?? 0) +
    weights.vol_trend * (f[11] ?? 0) +
    weights.rel_strength * (f[8] ?? 0) +
    weights.dev * (f[4] ?? 0);
  return sigmoid(x);
}

export type ComputeScoreOptions = {
  ctx?: OpContext;
  weights?: FallbackWeights;
  regime?: MarketRegime;
};

/**
 * Apply regime-aware multipliers to fallback weights.
 *  - bull   → boost fomo / pressure (catch hype faster)
 *  - bear   → damp fomo (reduce false BUYs in capitulation)
 *  - panic  → strongly damp fomo, lift liq_score (favor safety)
 */
export function regimeAdjustedWeights(
  base: FallbackWeights,
  regime: MarketRegime
): FallbackWeights {
  switch (regime) {
    case 'bull':
      return { ...base, fomo: base.fomo * 1.2, pressure: base.pressure * 1.1 };
    case 'bear':
      return { ...base, fomo: base.fomo * 0.6, pressure: base.pressure * 0.8 };
    case 'panic':
      return { ...base, fomo: base.fomo * 0.4, liq_score: base.liq_score * 1.5 };
    case 'neutral':
    default:
      return base;
  }
}

export function computeScore(
  factors: FactorVector,
  strategy: Strategy,
  optsOrCtx?: ComputeScoreOptions | OpContext
): ScoreResult {
  // Backward-compat: callers may still pass an OpContext directly.
  const opts: ComputeScoreOptions =
    optsOrCtx && 'ctx' in optsOrCtx
      ? (optsOrCtx as ComputeScoreOptions)
      : optsOrCtx
      ? { ctx: optsOrCtx as OpContext }
      : {};

  const baseWeights = opts.weights ?? DEFAULT_FALLBACK_WEIGHTS;
  const weights = opts.regime ? regimeAdjustedWeights(baseWeights, opts.regime) : baseWeights;

  if (strategy.mode === 'formula' && strategy.formula?.tokens?.length) {
    const raw = vm.execute(strategy.formula.tokens, factors, opts.ctx);
    if (raw == null) {
      return { score: fallbackScore(factors, weights), mode: 'fallback', raw: NaN, regime: opts.regime };
    }
    return { score: sigmoid(raw), mode: 'formula', raw, regime: opts.regime };
  }
  const score = fallbackScore(factors, weights);
  return { score, mode: 'fallback', raw: score, regime: opts.regime };
}

/**
 * Compute adaptive BUY / SELL thresholds from a recent score sample.
 * Falls back to fixed defaults if the sample is too small or degenerate.
 *
 *   buyTh  = max(buyMin, P(buyPercentile))
 *   sellTh = min(sellMax, P(sellPercentile))
 *
 * The clamp keeps the system from triggering on every score in flat markets,
 * and from going totally silent in compressed ones.
 */
export type AdaptiveThresholdsConfig = {
  buyPercentile?: number;   // default 0.75
  sellPercentile?: number;  // default 0.25
  buyMin?: number;          // floor on the BUY threshold (default 0.6)
  sellMax?: number;         // cap on the SELL threshold (default 0.4)
  minSamples?: number;      // default 30
  fallbackBuy?: number;     // default 0.7
  fallbackSell?: number;    // default 0.3
};

export function adaptiveThresholds(
  recentScores: ReadonlyArray<number>,
  cfg: AdaptiveThresholdsConfig = {}
): { buy: number; sell: number; samples: number; adaptive: boolean } {
  const minSamples = cfg.minSamples ?? 30;
  const fallback = { buy: cfg.fallbackBuy ?? 0.7, sell: cfg.fallbackSell ?? 0.3 };
  const finite = recentScores.filter((x) => Number.isFinite(x) && x >= 0 && x <= 1);
  if (finite.length < minSamples) {
    return { ...fallback, samples: finite.length, adaptive: false };
  }
  const sorted = [...finite].sort((a, b) => a - b);
  const p = (q: number) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
    return sorted[idx] ?? fallback.buy;
  };
  const buyP = p(cfg.buyPercentile ?? 0.75);
  const sellP = p(cfg.sellPercentile ?? 0.25);
  const buy = Math.max(cfg.buyMin ?? 0.6, buyP);
  const sell = Math.min(cfg.sellMax ?? 0.4, sellP);
  // Guard: BUY must stay strictly above SELL.
  if (buy <= sell) return { ...fallback, samples: finite.length, adaptive: false };
  return { buy, sell, samples: finite.length, adaptive: true };
}

/**
 * Detect the broad market regime from the most recent score and factor
 * snapshots across the universe. Uses three rough signals:
 *  - share of tokens with score > 0.5 (excitement)
 *  - share of tokens with score < 0.3 (capitulation)
 *  - mean of factor[11] (vol_trend, short/long volume ratio)
 */
export function detectMarketRegime(
  scores: ReadonlyArray<number>,
  vectors: ReadonlyArray<FactorVector>
): MarketRegime {
  if (scores.length < 10) return 'neutral';
  let high = 0;
  let low = 0;
  for (const s of scores) {
    if (s > 0.5) high++;
    if (s < 0.3) low++;
  }
  const highShare = high / scores.length;
  const lowShare = low / scores.length;
  let volSum = 0;
  let volN = 0;
  for (const v of vectors) {
    const x = v[11];
    if (typeof x === 'number' && Number.isFinite(x)) {
      volSum += x;
      volN++;
    }
  }
  const meanVolTrend = volN > 0 ? volSum / volN : 0;

  if (lowShare > 0.6 && meanVolTrend < -0.5) return 'panic';
  if (highShare > 0.6 && meanVolTrend > 0.5) return 'bull';
  if (lowShare > 0.5) return 'bear';
  return 'neutral';
}
