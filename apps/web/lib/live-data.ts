'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS } from '@/lib/swr-keys';

export type LiveRow = {
  address: string;
  symbol: string;
  name: string;
  image_url: string | null;
  price_usd: number | null;
  price_change_h24: number | null;
  liquidity_usd: number | null;
  score: number | null;
  spark: number[];
};

export type HorizonStats = { n: number; favorable: number | null; median_pct: number | null };
export type GroupStats = { n: number; flagged: number; lost_4h: number; horizons: Record<'15m' | '1h' | '4h', HorizonStats> };
export type TrackRecord = {
  at: number;
  days: number;
  events: Record<'buy_trigger' | 'sell_trigger' | 'fomo_spike', GroupStats>;
  baseline: GroupStats & { first_sample: number | null };
};

/** Tracked tokens with scores. The landing polls once a minute: scores change once a minute. */
export function useLiveRows() {
  return useSWR<{ rows: LiveRow[] }>(SWR_KEYS.scanner(), fetcher, { refreshInterval: 60_000, keepPreviousData: true });
}

/** Hourly track record summary written by the labeler. */
export function useTrackRecord() {
  return useSWR<{ record: TrackRecord | null }>(SWR_KEYS.strategy, fetcher, { refreshInterval: 300_000 });
}

/** Below this many priced outcomes a share is noise (same rule as the Strategy page). */
export const MIN_SAMPLE = 20;

export function shareOf(h: HorizonStats | undefined): number | null {
  if (!h || h.n < MIN_SAMPLE || h.favorable == null) return null;
  return h.favorable;
}
