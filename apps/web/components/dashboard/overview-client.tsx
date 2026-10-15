'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardValue } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScorePill } from '@/components/dashboard/score-pill';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { fmtPct, fmtUSD, pctTone, fmtTimeAgo, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';

type OverviewResponse = {
  buy_signals_1h: number;
  avg_score: number | null;
  leaders: Array<{
    address: string;
    symbol: string;
    image_url: string | null;
    score: number;
    price_change_h24: number | null;
    price_usd: number | null;
  }>;
  last_buys: Array<{
    address: string;
    symbol: string;
    image_url: string | null;
    score: number;
    time: number;
  }>;
};

export function OverviewClient() {
  const t = useTranslations('overview');
  const { data, error, isLoading } = useSWR<OverviewResponse>(SWR_KEYS.overview, fetcher, {
    refreshInterval: SWR_INTERVALS.overview
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg">{t('title')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('buy_signals_1h')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>
              {isLoading ? <Skeleton className="h-9 w-24" /> : data?.buy_signals_1h ?? '·'}
            </CardValue>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('avg_score')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>
              {isLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : data?.avg_score != null ? (
                (data.avg_score * 100).toFixed(0)
              ) : (
                '·'
              )}
            </CardValue>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('leaders')}</CardTitle>
              <Link href="/dashboard/scanner" className="flex items-center gap-1 text-xs text-accent hover:underline">
                {t('see_all')}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-sm text-danger">{t('load_error')}</div>
            ) : !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : data.leaders.length === 0 ? (
              <div className="py-6 text-center text-sm text-text-muted">{t('leaders_empty')}</div>
            ) : (
              <ul className="divide-y divide-border">
                {data.leaders.slice(0, 5).map((row, i) => {
                  const tone = pctTone(row.price_change_h24 ?? null);
                  return (
                    <li key={row.address}>
                      <Link
                        href={`/dashboard/token/${row.address}`}
                        className="flex items-center gap-3 py-3 transition-colors hover:bg-white/[0.02]"
                      >
                        <span className="w-5 text-xs text-text-muted">{i + 1}</span>
                        <TokenAvatar src={row.image_url} symbol={row.symbol} />
                        <span className="flex-1 truncate text-sm font-medium">
                          {row.symbol || shortenAddress(row.address)}
                        </span>
                        <span className="num-display text-xs text-text-muted">{fmtUSD(row.price_usd)}</span>
                        <span
                          className={cn(
                            'num-display w-20 text-right text-xs',
                            tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-text-muted'
                          )}
                        >
                          {fmtPct(row.price_change_h24, { sign: true })}
                        </span>
                        <ScorePill score={row.score} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('last_buys')}</CardTitle>
              <Link href="/dashboard/signals" className="flex items-center gap-1 text-xs text-accent hover:underline">
                {t('see_all')}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-sm text-danger">{t('load_error')}</div>
            ) : !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : data.last_buys.length === 0 ? (
              <div className="py-6 text-center text-sm text-text-muted">{t('buys_empty')}</div>
            ) : (
              <ul className="divide-y divide-border">
                {data.last_buys.slice(0, 5).map((ev) => (
                  <li key={`${ev.address}-${ev.time}`} className="flex items-center gap-3 py-3">
                    <Badge variant="success">BUY</Badge>
                    <TokenAvatar src={ev.image_url} symbol={ev.symbol} />
                    <Link
                      href={`/dashboard/token/${ev.address}`}
                      className="flex-1 truncate text-sm font-medium hover:text-accent"
                    >
                      {ev.symbol || shortenAddress(ev.address)}
                    </Link>
                    <ScorePill score={ev.score} />
                    <span className="w-24 text-right text-xs text-text-muted">
                      {fmtTimeAgo(ev.time * 1000, Date.now())}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
