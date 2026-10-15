'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FilterChips } from '@/components/ui/filter-chips';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { fmtTimeAgo, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TRADING_ENABLED } from '@/lib/trade';
import { BuyButton } from '@/components/trade/buy-button';

/** Older BUY signals get no Buy button: acting on a stale signal is not what the signal said. */
const BUY_FRESH_SEC = 3600;

type EventType = 'buy_trigger' | 'sell_trigger' | 'fomo_spike';
type SignalEvent = {
  id: number;
  address: string;
  symbol: string;
  image_url: string | null;
  time: number;
  event_type: EventType;
  score: number;
  prev_score: number | null;
};

const FILTERS = ['all', 'buy', 'sell', 'fomo'] as const;
type Filter = (typeof FILTERS)[number];

/** Same colors as the markers on the token chart. */
const DOT: Record<EventType, string> = { buy_trigger: 'bg-success', sell_trigger: 'bg-danger', fomo_spike: 'bg-warning' };

/** Every signal, newest first, as one table in the board's style. */
export function SignalsClient() {
  const t = useTranslations('signals');
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading } = useSWR<{ events: SignalEvent[] }>(SWR_KEYS.signals(filter === 'all' ? undefined : filter), fetcher, {
    refreshInterval: SWR_INTERVALS.signals,
    keepPreviousData: true
  });
  const label = (e: EventType) => (e === 'buy_trigger' ? t('type_buy') : e === 'sell_trigger' ? t('type_sell') : t('type_fomo'));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-lg">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">{t('subtitle')}</p>
      </div>

      <FilterChips items={FILTERS.map((f) => ({ id: f, label: t(`filter_${f}`) }))} value={filter} onChange={setFilter} label={t('filter_label')} />

      <div className="ring-hair relative overflow-x-auto rounded-xl bg-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="label px-3 py-2.5 text-left sm:px-5">{t('col_signal')}</th>
              <th scope="col" className="label px-2 py-2.5 text-left sm:px-3">{t('col_token')}</th>
              <th scope="col" className="label px-2 py-2.5 text-right sm:px-3">{t('col_score')}</th>
              <th scope="col" className="label hidden px-4 py-2.5 text-right sm:table-cell sm:px-5">{t('col_when')}</th>
              {TRADING_ENABLED && (
                <th scope="col" className="px-2 py-2.5 sm:px-5">
                  <span className="sr-only">{t('col_buy')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && !data
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={TRADING_ENABLED ? 5 : 4} className="px-5 py-2.5">
                      <div className="skeleton h-6 rounded" />
                    </td>
                  </tr>
                ))
              : data?.events.map((ev) => {
                  const burst = ev.event_type === 'fomo_spike';
                  return (
                    <tr key={ev.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-3 py-2.5 sm:whitespace-nowrap sm:px-5">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span aria-hidden className={cn('h-2 w-2 rounded-full', DOT[ev.event_type])} />
                          {label(ev.event_type)}
                        </span>
                        {/* Phones: the When column is hidden, so the time sits under the signal. */}
                        <span className="block pl-4 text-xs text-text-dim sm:hidden">{fmtTimeAgo(ev.time * 1000, Date.now())}</span>
                      </td>
                      <td className="max-w-[8rem] px-2 py-2.5 sm:max-w-[14rem] sm:px-3">
                        <Link href={`/dashboard/token/${ev.address}`} className="group flex items-center gap-2.5">
                          <TokenAvatar src={ev.image_url} symbol={ev.symbol} />
                          <span className="truncate font-medium group-hover:text-accent">{ev.symbol || shortenAddress(ev.address)}</span>
                        </Link>
                      </td>
                      <td className="num-display whitespace-nowrap px-2 py-2.5 text-right sm:px-3">
                        {/* A volume burst is not a score crossing: only the score at that moment. */}
                        {!burst && (
                          <span className="hidden sm:inline">
                            <span className="text-text-dim">{ev.prev_score == null ? '·' : Math.round(ev.prev_score * 100)}</span>
                            <span className="sr-only"> {t('prev_score')} </span>
                            <span aria-hidden className="mx-1.5 text-text-dim">→</span>
                          </span>
                        )}
                        <span className="font-semibold">{Math.round(ev.score * 100)}</span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-right text-text-muted sm:table-cell sm:px-5">{fmtTimeAgo(ev.time * 1000, Date.now())}</td>
                      {TRADING_ENABLED && (
                        <td className="px-2 py-2 text-right sm:px-5">
                          {ev.event_type === 'buy_trigger' && Date.now() / 1000 - ev.time < BUY_FRESH_SEC && (
                            <BuyButton address={ev.address} label={t('buy')} size="sm" quiet />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {data && !data.events.length && <p className="px-6 py-14 text-center text-sm text-text-muted">{t('empty')}</p>}
      </div>
    </div>
  );
}
