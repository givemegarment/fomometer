import { describe, expect, it } from 'vitest';
import { adaptiveThresholds, computeScore, DEFAULT_FALLBACK_WEIGHTS, fallbackScore, regimeAdjustedWeights } from './score';
import { computePopulationStats, normalizeByPopulation, sigmoid, softClamp } from './factors';
import type { FactorVector } from '../types';

const vec = (over: Partial<Record<number, number>> = {}): FactorVector =>
  Array.from({ length: 12 }, (_, i) => over[i] ?? 0) as unknown as FactorVector;

describe('sigmoid and clamps', () => {
  it('maps 0 to 0.5 and saturates without overflow', () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(1000)).toBe(1);
    expect(sigmoid(-1000)).toBe(0);
  });
  it('softClamp bounds values and turns NaN into 0', () => {
    expect(softClamp(9)).toBe(5);
    expect(softClamp(-9)).toBe(-5);
    expect(softClamp(Number.NaN)).toBe(0);
  });
});

describe('fallbackScore', () => {
  it('is 0.5 for an all-zero (average) token', () => {
    expect(fallbackScore(vec())).toBe(0.5);
  });
  it('rises with a positively weighted factor and ignores context-only ones', () => {
    expect(fallbackScore(vec({ 3: 2 }))).toBeGreaterThan(0.5); // fomo
    expect(fallbackScore(vec({ 0: 5, 5: 5, 6: 5, 9: 5, 10: 5 }))).toBe(0.5); // not in the score
  });
  it('computeScore uses the fallback when the formula has no tokens', () => {
    const r = computeScore(vec({ 2: 1 }), { mode: 'formula', formula: { tokens: [] } });
    expect(r.mode).toBe('fallback');
    expect(r.score).toBeCloseTo(fallbackScore(vec({ 2: 1 })));
  });
});

describe('regimeAdjustedWeights', () => {
  it('damps the burst weight in panic and leaves neutral alone', () => {
    expect(regimeAdjustedWeights(DEFAULT_FALLBACK_WEIGHTS, 'panic').fomo).toBeLessThan(DEFAULT_FALLBACK_WEIGHTS.fomo);
    expect(regimeAdjustedWeights(DEFAULT_FALLBACK_WEIGHTS, 'neutral')).toBe(DEFAULT_FALLBACK_WEIGHTS);
  });
});

describe('cross-sectional normalization', () => {
  it('z-scores each factor against the population', () => {
    const pop = [vec({ 2: 1 }), vec({ 2: 3 })];
    const stats = computePopulationStats(pop);
    const z = normalizeByPopulation(vec({ 2: 3 }), stats);
    expect(z[2]).toBeCloseTo(1); // mean 2, std 1
  });
  it('passes a constant factor through the clamp instead of dividing by zero', () => {
    const pop = [vec({ 1: 7 }), vec({ 1: 7 })];
    const z = normalizeByPopulation(vec({ 1: 7 }), computePopulationStats(pop));
    expect(z[1]).toBe(5);
  });
});

describe('adaptiveThresholds', () => {
  it('falls back to fixed levels on a small sample', () => {
    expect(adaptiveThresholds([0.5, 0.6])).toMatchObject({ buy: 0.7, sell: 0.3, adaptive: false });
  });
  it('uses percentiles with the floor and cap on a full sample', () => {
    const scores = Array.from({ length: 101 }, (_, i) => i / 100);
    const r = adaptiveThresholds(scores);
    expect(r.adaptive).toBe(true);
    expect(r.buy).toBeCloseTo(0.75);
    expect(r.sell).toBeCloseTo(0.25);
  });
});
