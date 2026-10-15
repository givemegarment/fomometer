'use client';

import { useTranslations } from 'next-intl';
import { TokenAvatar } from '@/components/dashboard/token-avatar';
import { fmtPct, pctTone } from '@/lib/format';
import { useLiveRows } from '@/lib/live-data';
import { cn } from '@/lib/cn';

/** Endless strip of the tokens tracked right now (the reference's marquee, with live data). */
export function TickerMarquee() {
  const t = useTranslations('landing');
  const { data } = useLiveRows();
  const rows = data?.rows ?? [];
  if (!rows.length) return <div aria-hidden className="h-[60px]" />;

  const strip = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-8 pr-8">
      {rows.map((r) => {
        const tone = pctTone(r.price_change_h24);
        return (
          <li key={r.address} className="flex items-center gap-2 whitespace-nowrap text-sm">
            <TokenAvatar src={r.image_url} symbol={r.symbol} />
            <span className="font-semibold">{r.symbol}</span>
            <span className={cn('num-display', tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-text-muted')}>
              {fmtPct(r.price_change_h24, { sign: true, digits: Math.abs(r.price_change_h24 ?? 0) >= 1000 ? 0 : 1 })}
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section aria-label={t('marquee_label')} className="relative overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max animate-marquee motion-reduce:animate-none">
        {strip(false)}
        {strip(true)}
      </div>
    </section>
  );
}
