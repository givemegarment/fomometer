'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { Price } from '@/components/ui/price';
import { buttonVariants } from '@/components/ui/button-variants';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS } from '@/lib/swr-keys';
import { fmtPct, pctTone, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useWatchlist } from '@/lib/watchlist';

type Row = {
  address: string;
  symbol: string;
  name: string;
  image_url: string | null;
  price_usd: number | null;
  price_change_h24: number | null;
  score: number | null;
};

/** Starred tokens (kept in this browser) as a board-style table. */
export function WatchlistClient() {
  const t = useTranslations('watchlist');
  const watchlist = useWatchlist();
  const { data, isLoading } = useSWR<{ rows: Row[] }>(SWR_KEYS.watchlist(watchlist.list), fetcher, { keepPreviousData: true });
  // Rows for addresses still in the list (removal is instant, before the refetch lands).
  const rows = watchlist.list.length ? (data?.rows ?? []).filter((r) => watchlist.has(r.address)) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-lg">{t('title')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('subtitle')}</p>
      </div>

      {!watchlist.ready || (isLoading && !data && watchlist.list.length > 0) ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-12 rounded-md" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState
          title={t('empty_title')}
          body={t('empty_body')}
          icon={<Star className="h-5 w-5" />}
          cta={
            <Link href="/dashboard" className={buttonVariants({ size: 'md' })}>
              {t('open_board')}
            </Link>
          }
        />
      ) : (
        <div className="ring-hair relative overflow-x-auto rounded-xl bg-bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="label px-4 py-2.5 text-left sm:px-5">{t('col_token')}</th>
                <th scope="col" className="label px-3 py-2.5 text-right">{t('col_score')}</th>
                <th scope="col" className="label hidden px-3 py-2.5 text-right sm:table-cell">{t('col_price')}</th>
                <th scope="col" className="label px-3 py-2.5 text-right">{t('col_24h')}</th>
                <th scope="col" className="w-12 px-2 py-2.5">
                  <span className="sr-only">{t('remove')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const tone = pctTone(row.price_change_h24);
                return (
                  <tr key={row.address} className="transition-colors hover:bg-white/[0.03]">
                    <td className="max-w-[16rem] px-4 py-2.5 sm:px-5">
                      <Link href={`/dashboard/token/${row.address}`} className="group flex items-center gap-2.5">
                        <TokenAvatar src={row.image_url} symbol={row.symbol} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:text-accent">{row.symbol || shortenAddress(row.address)}</span>
                          <span className="block truncate text-xs text-text-dim">{row.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={cn('num-display px-3 py-2.5 text-right font-semibold', row.score != null && row.score >= 0.7 && 'text-accent')}>
                      {row.score == null ? '·' : Math.round(row.score * 100)}
                    </td>
                    <td className="num-display hidden px-3 py-2.5 text-right sm:table-cell">
                      <Price value={row.price_usd} />
                    </td>
                    <td className={cn('num-display px-3 py-2.5 text-right', tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-text-muted')}>
                      {fmtPct(row.price_change_h24, { sign: true, digits: 1 })}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => watchlist.toggle(row.address)}
                        aria-label={t('remove')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-accent transition-colors hover:bg-white/[0.06]"
                      >
                        <Star className="h-4 w-4 fill-accent" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
