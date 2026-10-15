/**
 * Sanity check for the new scoring helpers:
 *   computePopulationStats / normalizeByPopulation
 *   adaptiveThresholds
 *   detectMarketRegime
 *   regimeAdjustedWeights / fallbackScore weight overrides
 *
 * Run:
 *   npx -y tsx packages/shared/src/engine/__tests__/score.ts
 */
import {
  computePopulationStats,
  normalizeByPopulation,
  adaptiveThresholds,
  detectMarketRegime,
  regimeAdjustedWeights,
  fallbackScore,
  DEFAULT_FALLBACK_WEIGHTS
} from '../index';
import type { FactorVector } from '../../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function close(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

function fv(vals: number[]): FactorVector {
  const padded = [...vals];
  while (padded.length < 12) padded.push(0);
  return padded.slice(0, 12) as unknown as FactorVector;
}

// --- population stats / z-score ---
{
  const a = fv([0, 0, 0, 1]);
  const b = fv([0, 0, 0, 2]);
  const c = fv([0, 0, 0, 3]);
  const stats = computePopulationStats([a, b, c]);
  assert(close(stats[3]!.mean, 2), 'fomo mean');
  assert(stats[3]!.std > 0, 'fomo std positive');

  const norm = normalizeByPopulation(b, stats);
  assert(close(norm[3] ?? 0, 0, 1e-6), 'centered fomo at mean → 0');
  const normHigh = normalizeByPopulation(c, stats);
  assert((normHigh[3] ?? 0) > 0, 'above-mean fomo → positive z');
}

// --- adaptiveThresholds ---
{
  const tooFew = adaptiveThresholds([0.5, 0.6], { minSamples: 10 });
  assert(!tooFew.adaptive, 'falls back when sample too small');
  assert(tooFew.buy === 0.7 && tooFew.sell === 0.3, 'fallback values');

  const sample: number[] = [];
  for (let i = 0; i < 100; i++) sample.push(i / 100);
  const adapt = adaptiveThresholds(sample, { minSamples: 10 });
  assert(adapt.adaptive, 'adaptive when enough samples');
  assert(adapt.buy > adapt.sell, 'buy strictly > sell');
  assert(adapt.buy >= 0.6, 'buy floor honored');
  assert(adapt.sell <= 0.4, 'sell cap honored');
}

// --- detectMarketRegime ---
{
  const bullScores = Array.from({ length: 50 }, (_, i) => (i < 35 ? 0.7 : 0.4));
  const bullVecs = bullScores.map(() => fv([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0]));
  assert(detectMarketRegime(bullScores, bullVecs) === 'bull', 'bull regime');

  const panicScores = Array.from({ length: 50 }, () => 0.1);
  const panicVecs = panicScores.map(() => fv([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1.0]));
  assert(detectMarketRegime(panicScores, panicVecs) === 'panic', 'panic regime');

  const flatScores = Array.from({ length: 50 }, () => 0.45);
  const flatVecs = flatScores.map(() => fv([0]));
  assert(detectMarketRegime(flatScores, flatVecs) === 'neutral', 'neutral regime');
}

// --- regimeAdjustedWeights / weight override ---
{
  const fomoVec = fv([0, 0, 0, 5]);
  const baseScore = fallbackScore(fomoVec);
  const bullW = regimeAdjustedWeights(DEFAULT_FALLBACK_WEIGHTS, 'bull');
  const bullScore = fallbackScore(fomoVec, bullW);
  assert(bullScore > baseScore, 'bull regime amplifies fomo signal');
  const bearW = regimeAdjustedWeights(DEFAULT_FALLBACK_WEIGHTS, 'bear');
  const bearScore = fallbackScore(fomoVec, bearW);
  assert(bearScore < baseScore, 'bear regime damps fomo signal');
}

console.log('engine score helpers: OK');
