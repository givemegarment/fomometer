'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScorePill } from '@/components/dashboard/score-pill';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { fmtTimeAgo, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';

type SignalEvent = {
  id: number;
  address: string;
  symbol: string;
  image_url: string | null;
  time: number;
  event_type: 'buy_trigger' | 'sell_trigger' | 'fomo_spike';
  score: number;
  prev_score: number | null;
};

const FILTERS = ['all', 'buy', 'sell', 'fomo'] as const;
type Filter = (typeof FILTERS)[number];

export function SignalsClient() {
  const t = useTranslations('signals');
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading } = useSWR<{ events: SignalEvent[] }>(
    SWR_KEYS.signals(filter === 'all' ? undefined : filter),
    fetcher,
    { refreshInterval: SWR_INTERVALS.signals, keepPreviousData: true }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display-lg">{t('title')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('subtitle')}</p>
        </div>
        <div role="group" className="flex items-center gap-1 rounded-pill border border-border bg-bg-card p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'whitespace-nowrap rounded-pill px-3 py-1 text-xs transition-colors',
                filter === f ? 'bg-accent text-bg-base' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {t(`filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !data?.events?.length ? (
            <div className="px-6 py-16 text-center text-sm text-text-muted">{t('empty')}</div>
          ) : (
            <ul className="divide-y divide-border">
              {data.events.map((ev) => {
                const isFomo = ev.event_type === 'fomo_spike';
                const v = ev.event_type === 'buy_trigger' ? 'success' : ev.event_type === 'sell_trigger' ? 'danger' : 'warning';
                const Icon = ev.event_type === 'buy_trigger' ? ArrowUp : ev.event_type === 'sell_trigger' ? ArrowDown : Flame;
                const label =
                  ev.event_type === 'buy_trigger' ? t('type_buy') : ev.event_type === 'sell_trigger' ? t('type_sell') : t('type_fomo');
                return (
                  <li key={ev.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]">
                    <Badge variant={v} className="w-28 justify-center">
                      <Icon className="h-3 w-3" aria-hidden />
                      {label}
                    </Badge>
                    <TokenAvatar src={ev.image_url} symbol={ev.symbol} />
                    <Link
                      href={`/dashboard/token/${ev.address}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent"
                    >
                      {ev.symbol || shortenAddress(ev.address)}
                    </Link>
                    {/* A volume burst is not a score crossing: show only the score at that moment. */}
                    {!isFomo && (
                      <>
                        <span className="sr-only">{t('prev_score')}</span>
                        <ScorePill score={ev.prev_score} className="hidden sm:inline-flex" />
                        <span className="hidden text-text-muted sm:inline" aria-hidden>
                          →
                        </span>
                      </>
                    )}
                    <ScorePill score={ev.score} />
                    <span className="w-24 text-right text-xs text-text-muted">
                      {fmtTimeAgo(ev.time * 1000, Date.now())}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
