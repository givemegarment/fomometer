'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScorePill } from '@/components/dashboard/score-pill';
import { Sparkline } from '@/components/ui/sparkline';
import { Skeleton } from '@/components/ui/skeleton';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { fmtPct, fmtUSD, pctTone, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { useWatchlist } from '@/lib/watchlist';

type Filter = 'all' | 'score' | 'liq' | 'fomo';

type ScannerRow = {
  address: string;
  symbol: string;
  name: string;
  image_url: string | null;
  price_usd: number | null;
  price_change_h24: number | null;
  liquidity_usd: number | null;
  fdv: number | null;
  fomo_factor: number | null;
  score: number | null;
  spark: number[];
};

export function ScannerClient() {
  const t = useTranslations('scanner');
  const tFilters = useTranslations('scanner.filters');
  const tCol = useTranslations('scanner.col');
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading } = useSWR<{ rows: ScannerRow[] }>(SWR_KEYS.scanner(filter === 'all' ? undefined : filter), fetcher, {
    refreshInterval: SWR_INTERVALS.scanner,
    keepPreviousData: true
  });

  const watchlist = useWatchlist();

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: tFilters('all') },
    { id: 'score', label: tFilters('score_high') },
    { id: 'liq', label: tFilters('liq_high') },
    { id: 'fomo', label: tFilters('fomo_high') }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display-lg">{t('title')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('subtitle')}</p>
        </div>
        <div className="-mx-3 max-w-[calc(100%+1.5rem)] overflow-x-auto px-3 sm:mx-0 sm:max-w-full sm:px-0">
        <div role="group" className="flex w-max items-center gap-1 rounded-pill border border-border bg-bg-card p-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'whitespace-nowrap rounded-pill px-3 py-1 text-xs transition-colors',
                filter === f.id ? 'bg-accent text-bg-base' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elev/40 text-xs text-text-muted">
                  <th className="w-10 px-2 py-3 text-left sm:w-12 sm:px-4">{tCol('rank')}</th>
                  <th className="px-2 py-3 text-left sm:px-4">{tCol('token')}</th>
                  <th className="px-2 py-3 text-right sm:px-4">{tCol('score')}</th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">{tCol('price')}</th>
                  <th className="px-2 py-3 text-right sm:px-4">{tCol('change_24h')}</th>
                  <th className="hidden px-4 py-3 text-right lg:table-cell">{tCol('liquidity')}</th>
                  <th className="hidden px-4 py-3 text-right xl:table-cell">{tCol('fdv')}</th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">{tCol('fomo')}</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">{tCol('spark')}</th>
                  <th className="w-9 px-1 py-3 sm:w-10 sm:px-2"><span className="sr-only">{t('watch_add')}</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && !data
                  ? Array.from({ length: 12 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-6" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-24" />
                        </td>
                        <td className="px-4 py-3" colSpan={8}>
                          <Skeleton className="h-4" />
                        </td>
                      </tr>
                    ))
                  : data?.rows?.map((row, i) => {
                      const tone = pctTone(row.price_change_h24);
                      return (
                        <tr
                          key={row.address}
                          className="group border-b border-border transition-colors hover:bg-white/[0.02]"
                        >
                          <td className="px-2 py-3 text-text-muted sm:px-4">{i + 1}</td>
                          <td className="px-2 py-3 sm:px-4">
                            <Link
                              href={`/dashboard/token/${row.address}`}
                              className="flex items-center gap-2 font-medium hover:text-accent sm:gap-3"
                            >
                              <TokenAvatar src={row.image_url} symbol={row.symbol} />
                              <span className="flex flex-col">
                                <span className="truncate">{row.symbol || shortenAddress(row.address)}</span>
                                <span className="num-display text-[10px] text-text-muted md:hidden">
                                  {fmtUSD(row.price_usd)}
                                </span>
                              </span>
                              <span className="hidden text-xs text-text-muted lg:inline">{row.name}</span>
                            </Link>
                          </td>
                          <td className="px-2 py-3 text-right sm:px-4">
                            <ScorePill score={row.score} />
                          </td>
                          <td className="num-display hidden px-4 py-3 text-right md:table-cell">{fmtUSD(row.price_usd)}</td>
                          <td
                            className={cn(
                              'num-display px-2 py-3 text-right text-xs sm:px-4 sm:text-sm',
                              tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-text-muted'
                            )}
                          >
                            {fmtPct(row.price_change_h24, { sign: true })}
                          </td>
                          <td className="num-display hidden px-4 py-3 text-right text-text-muted lg:table-cell">
                            {fmtUSD(row.liquidity_usd, { compact: true })}
                          </td>
                          <td className="num-display hidden px-4 py-3 text-right text-text-muted xl:table-cell">
                            {fmtUSD(row.fdv, { compact: true })}
                          </td>
                          <td className="num-display hidden px-4 py-3 text-right md:table-cell">
                            {row.fomo_factor != null ? row.fomo_factor.toFixed(2) : '·'}
                          </td>
                          <td className="hidden px-4 py-3 text-right sm:table-cell">
                            <Sparkline data={row.spark} className="ml-auto" />
                          </td>
                          <td className="px-1 py-3 text-center sm:px-2">
                            <button
                              type="button"
                              onClick={() => watchlist.toggle(row.address)}
                              aria-pressed={watchlist.has(row.address)}
                              aria-label={watchlist.has(row.address) ? t('watch_remove') : t('watch_add')}
                              className={cn(
                                'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                                watchlist.has(row.address)
                                  ? 'text-warning'
                                  : 'text-text-dim hover:text-warning'
                              )}
                            >
                              <Star className={cn('h-4 w-4', watchlist.has(row.address) && 'fill-warning')} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            {data?.rows?.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-text-muted">{t('empty')}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
