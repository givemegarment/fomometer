'use client';

import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { cn } from '@/lib/cn';

/** Prices older than this mean the pipeline is not live. */
const LIVE_MAX_AGE_SEC = 3 * 60;

type Status = { snapshot_at: number | null; scored_at: number | null };

/** LIVE / STALE from the newest snapshot. */
export function StatusBadge({ className }: { className?: string }) {
  const t = useTranslations('status');
  const { data } = useSWR<Status>(SWR_KEYS.status, fetcher, { refreshInterval: SWR_INTERVALS.status });

  const now = Date.now();
  const snap = data?.snapshot_at ? data.snapshot_at * 1000 : null;
  const live = snap != null && now - snap <= LIVE_MAX_AGE_SEC * 1000;

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)} role="status">
      <span className={cn('inline-flex items-center gap-1.5 font-semibold', !data ? 'text-text-dim' : live ? 'text-success' : 'text-warning')}>
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', !data ? 'bg-text-dim' : live ? 'bg-success' : 'bg-warning')}
        />
        {!data ? t('connecting') : live ? 'LIVE' : 'STALE'}
      </span>
    </div>
  );
}
