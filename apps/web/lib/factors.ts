/**
 * The 12 factors in the order the API returns them (see /api/tokens/[address]).
 * `inScore`: whether the factor enters the weighted sum behind the score
 * (packages/shared/src/engine/score.ts); the rest are shown for context only.
 */
export const FACTORS = [
  { key: 'ret', inScore: false },
  { key: 'liq_score', inScore: true },
  { key: 'pressure', inScore: true },
  { key: 'fomo', inScore: true },
  { key: 'dev', inScore: true },
  { key: 'log_vol', inScore: false },
  { key: 'vol_cluster', inScore: false },
  { key: 'momentum_rev', inScore: true },
  { key: 'rel_strength', inScore: true },
  { key: 'hl_range', inScore: false },
  { key: 'close_pos', inScore: false },
  { key: 'vol_trend', inScore: true }
] as const;

export type FactorKey = (typeof FACTORS)[number]['key'];
