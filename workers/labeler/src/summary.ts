/** Pure statistics for the track record summary (tested in summary.test.ts). */

export type HorizonStats = { n: number; favorable: number | null; median_pct: number | null };
export type GroupStats = {
  /** Outcomes in the window, including flagged ones. */
  n: number;
  /** Left out of every statistic: best price above 11x entry (suspect pool switch). */
  flagged: number;
  /** Not flagged, but no price within the tolerance after 4 h. */
  lost_4h: number;
  horizons: Record<'15m' | '1h' | '4h', HorizonStats>;
};

export type Priced = { flagged: boolean; '15m': number | null; '1h': number | null; '4h': number | null };

export function summarize(rows: Priced[], down: boolean): GroupStats {
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

export function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
