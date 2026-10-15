import { describe, expect, it } from 'vitest';
import { median, num, summarize, type Priced } from './summary';

const row = (p: Partial<Priced>): Priced => ({ flagged: false, '15m': null, '1h': null, '4h': null, ...p });

describe('median', () => {
  it('handles empty, odd and even samples', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('num', () => {
  it('keeps finite numbers only', () => {
    expect(num(1.5)).toBe(1.5);
    expect(num(Number.NaN)).toBeNull();
    expect(num('1')).toBeNull();
    expect(num(null)).toBeNull();
  });
});

describe('summarize', () => {
  const rows = [
    row({ '1h': 2, '4h': 5 }),
    row({ '1h': -1, '4h': -3 }),
    row({ '1h': 1, '4h': null }), // lost at 4h
    row({ flagged: true, '1h': 900, '4h': 1500 }) // suspect pool switch
  ];

  it('counts favorable as price up, leaves flagged rows out and counts lost 4h prices', () => {
    const g = summarize(rows, false);
    expect(g.n).toBe(4);
    expect(g.flagged).toBe(1);
    expect(g.lost_4h).toBe(1);
    expect(g.horizons['1h']).toEqual({ n: 3, favorable: 2 / 3, median_pct: 1 });
    expect(g.horizons['4h']).toEqual({ n: 2, favorable: 0.5, median_pct: 1 });
    expect(g.horizons['15m']).toEqual({ n: 0, favorable: null, median_pct: null });
  });

  it('counts favorable as price down for SELL', () => {
    expect(summarize(rows, true).horizons['1h'].favorable).toBeCloseTo(1 / 3);
  });
});
