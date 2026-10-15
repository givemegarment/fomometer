'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Star, ScanSearch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScorePill } from '@/components/dashboard/score-pill';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS } from '@/lib/swr-keys';
import { fmtPct, fmtUSD, pctTone, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useWatchlist } from '@/lib/watchlist';
import { TokenAvatar } from '@/components/dashboard/token-avatar';

type Row = {
  address: string;
  symbol: string;
  name: string;
  image_url: string | null;
  price_usd: number | null;
  price_change_h24: number | null;
  score: number | null;
};

export function WatchlistClient() {
  const t = useTranslations('watchlist');
  const tScan = useTranslations('scanner');
  const watchlist = useWatchlist();
  const { data, isLoading } = useSWR<{ rows: Row[] }>(SWR_KEYS.watchlist(watchlist.list), fetcher, {
    keepPreviousData: true
  });
  // Rows for addresses still in the list (removal is instant, before the refetch lands).
  const rows = watchlist.list.length ? (data?.rows ?? []).filter((r) => watchlist.has(r.address)) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-display-lg">{t('title')}</h1>

      {!watchlist.ready || (isLoading && !data) ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState
          title={t('empty_title')}
          body={t('empty_body')}
          icon={<Star className="h-5 w-5" />}
          cta={
            <Button asChild variant="primary" size="md">
              <Link href="/dashboard">
                <ScanSearch className="h-4 w-4" aria-hidden />
                {t('open_scanner')}
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((row) => {
                const tone = pctTone(row.price_change_h24);
                return (
                  <li key={row.address} className="flex items-center gap-3 px-4 py-3">
                    <Link
                      href={`/dashboard/token/${row.address}`}
                      className="flex flex-1 items-center gap-3 truncate text-sm font-medium hover:text-accent"
                    >
                      <TokenAvatar src={row.image_url} symbol={row.symbol} />
                      <span>{row.symbol || shortenAddress(row.address)}</span>
                      <span className="hidden text-xs text-text-muted lg:inline">{row.name}</span>
                    </Link>
                    <span className="num-display w-24 text-right text-xs text-text-muted">
                      {fmtUSD(row.price_usd)}
                    </span>
                    <span
                      className={cn(
                        'num-display w-20 text-right text-xs',
                        tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-text-muted'
                      )}
                    >
                      {fmtPct(row.price_change_h24, { sign: true })}
                    </span>
                    <ScorePill score={row.score} />
                    <button
                      type="button"
                      onClick={() => watchlist.toggle(row.address)}
                      aria-label={tScan('watch_remove')}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-warning transition-colors hover:bg-warning/10"
                    >
                      <Star className="h-4 w-4 fill-warning" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
