'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { ScorePill } from '@/components/dashboard/score-pill';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { StatusBadge } from '@/components/status-badge';
import { Sparkline } from '@/components/ui/sparkline';
import { Skeleton } from '@/components/ui/skeleton';
import { fetcher } from '@/lib/fetcher';
import { SWR_KEYS, SWR_INTERVALS } from '@/lib/swr-keys';
import { fmtPct, fmtUSD, pctTone, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/cn';

type Row = {
  address: string;
  symbol: string;
  name: string;
  image_url: string | null;
  price_usd: number | null;
  price_change_h24: number | null;
  score: number | null;
  spark: number[];
};

/** Real top-5 from the scanner API: the landing shows the product, not a mock. */
export function LiveBoard() {
  const t = useTranslations('landing');
  const tCol = useTranslations('scanner.col');
  const { data, error } = useSWR<{ rows: Row[] }>(SWR_KEYS.scanner(), fetcher, {
    refreshInterval: SWR_INTERVALS.scanner
  });
  const rows = data?.rows?.slice(0, 5) ?? [];

  return (
    <section aria-labelledby="live-board-title" className="min-w-0">
      <div className="rounded-lg border border-border bg-bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 id="live-board-title" className="text-sm font-semibold">
            {t('board_title')}
          </h2>
          <StatusBadge detailed />
        </div>
        {error ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">{t('board_error')}</p>
        ) : !data ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">{t('board_empty')}</p>
        ) : (
          <>
            <div
              aria-hidden
              className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-text-muted sm:px-5"
            >
              <span className="w-4">#</span>
              <span className="flex-1">{t('col_token')}</span>
              <span className="w-20 text-right">{tCol('change_24h')}</span>
              <span className="hidden w-20 text-center md:block">{tCol('spark')}</span>
              <span className="w-10 text-right">{t('col_score')}</span>
            </div>
            <ol className="divide-y divide-border">
              {rows.map((row, i) => {
                const tone = pctTone(row.price_change_h24);
                return (
                  <li key={row.address}>
                    <Link
                      href={`/dashboard/token/${row.address}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:px-5"
                    >
                      <span className="w-4 text-xs text-text-muted">{i + 1}</span>
                      <TokenAvatar src={row.image_url} symbol={row.symbol} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {row.symbol || shortenAddress(row.address)}
                        </span>
                        <span className="num-display block truncate text-xs text-text-muted">
                          {fmtUSD(row.price_usd)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'num-display w-20 text-right text-sm',
                          tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-text-muted'
                        )}
                      >
                        {fmtPct(row.price_change_h24, { sign: true })}
                      </span>
                      <Sparkline data={row.spark} className="hidden md:block" />
                      <span className="flex w-10 justify-end">
                        <ScorePill score={row.score} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        <div className="border-t border-border px-4 py-3 sm:px-5">
          <Link
            href="/dashboard/scanner"
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            {t('board_more')}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
      <p className="mt-3 text-xs text-text-dim">{t('board_note')}</p>
    </section>
  );
}
