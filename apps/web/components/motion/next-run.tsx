'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';

type Status = { snapshot_at: number | null; scored_at: number | null };

/** The engine runs once a minute; it usually lands this many seconds after the last run. */
const RUN_EVERY_SEC = 60;

/**
 * Seconds until the next scoring run, from the last run time in /api/status, plus how far
 * the current minute has progressed (0..1). Returns nulls until status has loaded.
 */
export function useNextRun(): { secondsLeft: number | null; progress: number | null; lastRun: number | null } {
  const { data } = useSWR<Status>(SWR_KEYS.status, fetcher, { refreshInterval: SWR_INTERVALS.status });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const last = data?.scored_at ?? null;
  if (last == null) return { secondsLeft: null, progress: null, lastRun: null };
  const elapsed = Math.max(0, now / 1000 - last);
  const intoMinute = elapsed % RUN_EVERY_SEC;
  return { secondsLeft: Math.ceil(RUN_EVERY_SEC - intoMinute), progress: intoMinute / RUN_EVERY_SEC, lastRun: last };
}
