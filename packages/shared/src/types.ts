/** Core domain types shared between web app and workers. */

export type Snapshot = {
  address: string;
  time: number; // unix seconds
  price_usd: number;
  price_native: number | null;
  market_cap: number | null;
  fdv: number | null;
  liquidity_usd: number;
  volume_m5: number;
  volume_h1: number;
  volume_h6: number;
  volume_h24: number;
  price_change_m5: number;
  price_change_h1: number;
  price_change_h6: number;
  price_change_h24: number;
  buys_h1: number;
  sells_h1: number;
};

export type TokenMeta = {
  address: string;
  symbol: string;
  name: string;
  pair_address: string | null;
  dex_id: string | null;
  image_url: string | null;
  socials_json: string | null;
};

export type FactorVector = readonly [
  number, // ret
  number, // liq_score
  number, // pressure
  number, // fomo
  number, // dev
  number, // log_vol
  number, // vol_cluster
  number, // momentum_rev
  number, // rel_strength
  number, // hl_range
  number, // close_pos
  number  // vol_trend
];

export const FACTOR_KEYS = [
  'ret',
  'liq_score',
  'pressure',
  'fomo',
  'dev',
  'log_vol',
  'vol_cluster',
  'momentum_rev',
  'rel_strength',
  'hl_range',
  'close_pos',
  'vol_trend'
] as const;

export type FactorKey = (typeof FACTOR_KEYS)[number];

export const FACTOR_DESCRIPTIONS: Record<FactorKey, string> = {
  ret: 'log-return per minute (price_now / price_prev)',
  liq_score: 'liquidity health: clamp(liquidity / fdv * 4, 0, 1)',
  pressure: 'buy/sell imbalance over last hour: (buys - sells) / (buys + sells)',
  fomo: 'volume acceleration: (volume_m5 * 12 - volume_h1) / volume_h1',
  dev: 'price deviation from 20-min moving average',
  log_vol: 'log(1 + volume_h1) — magnitude of activity',
  vol_cluster: 'rolling std of returns over 10-min window',
  momentum_rev: 'reversal of summed returns over 5-min window (sign flip)',
  rel_strength: 'RSI-14 on 1-minute returns, normalized to [-1, 1]',
  hl_range: 'absolute price change over last hour',
  close_pos: 'price position inside last-hour high/low range',
  vol_trend: 'short vs long volume ratio: (volume_h1 - volume_h6/6) / (volume_h6/6)'
};

export type Strategy =
  | { mode: 'fallback'; formula: null }
  | { mode: 'formula'; formula: { tokens: number[]; trained_at?: string; meta?: Record<string, unknown> } };

export type SignalEvent = {
  id?: number;
  address: string;
  time: number;
  event_type: 'buy_trigger' | 'sell_trigger' | 'fomo_spike';
  score: number;
  prev_score: number | null;
  metadata_json?: string | null;
};
