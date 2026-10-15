'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { Sparkline } from '@/components/ui/sparkline';
import { Price } from '@/components/ui/price';
import { fmtPct, pctTone, shortenAddress } from '@/lib/format';
import { useLiveRows } from '@/lib/live-data';
import { cn } from '@/lib/cn';

/** Real top 5 from the scanner API, as a glass card: the landing shows the product, not a mock. */
export function LiveBoard() {
  const t = useTranslations('landing');
  const { data, error } = useLiveRows();
  const rows = data?.rows.slice(0, 5) ?? [];

  return (
    <div className="ring-hair overflow-hidden rounded-2xl bg-[#141415]/80 text-left backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-[15px] font-semibold">{t('board_title')}</p>
        <span className="text-xs text-white/70">
          {t('col_24h')} · {t('col_score')}
        </span>
      </div>
      {error ? (
        <p className="px-5 pb-8 pt-4 text-center text-sm text-text-muted">{t('board_error')}</p>
      ) : !data ? (
        <div className="space-y-2 px-5 pb-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-11 rounded-md" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-8 pt-4 text-center text-sm text-text-muted">{t('board_empty')}</p>
      ) : (
        <ol>
          {rows.map((row, i) => {
            const tone = pctTone(row.price_change_h24);
            const score = row.score == null ? null : Math.round(row.score * 100);
            return (
              <li key={row.address} className="border-t border-white/[0.06]">
                <Link href={`/dashboard/token/${row.address}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.04]">
                  <span className="num-display w-4 text-xs text-white/60">{i + 1}</span>
                  <TokenAvatar src={row.image_url} symbol={row.symbol} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{row.symbol || shortenAddress(row.address)}</span>
                    <Price value={row.price_usd} className="num-display block text-xs text-white/70" />
                  </span>
                  <Sparkline data={row.spark} width={64} height={22} className="hidden sm:block" />
                  <span
                    className={cn(
                      'num-display w-20 text-right text-sm',
                      tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-white/70'
                    )}
                  >
                    {fmtPct(row.price_change_h24, { sign: true, digits: Math.abs(row.price_change_h24 ?? 0) >= 1000 ? 0 : 1 })}
                  </span>
                  <span className={cn('num-display w-9 text-right text-[15px] font-semibold', score != null && score >= 70 ? 'text-accent' : 'text-white')}>
                    {score ?? '·'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <Link href="/dashboard" className="flex items-center justify-center gap-1.5 border-t border-white/[0.06] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.04]">
        {t('board_more')}
      </Link>
    </div>
  );
}
