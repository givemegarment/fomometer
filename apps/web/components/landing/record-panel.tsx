'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { buttonVariants } from '@/components/ui/button-variants';
import { useTrackRecord, shareOf, type GroupStats } from '@/lib/live-data';

/** White panel (the reference's tokenomics block) with the honest track record: ring + numbers. */
export function RecordPanel() {
  const t = useTranslations('landing');
  const { data } = useTrackRecord();
  const r = data?.record ?? null;
  const days = r?.days ?? 7;
  const buyShare = shareOf(r?.events.buy_trigger.horizons['4h']);

  return (
    <section className="px-3 sm:px-8">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-3xl bg-[radial-gradient(120%_90%_at_50%_10%,#FFFFFF_55%,#C9D4E6_100%)] px-5 py-20 text-bg-base sm:px-10 sm:py-24">
        <Reveal className="text-center">
          <h2 className="text-display-lg">{t('record_title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-black/60">{t('record_sub', { days })}</p>
        </Reveal>
        <div className="mx-auto mt-14 grid max-w-[1000px] items-center gap-12 md:grid-cols-[minmax(0,320px)_1fr]">
          <Reveal className="mx-auto w-full max-w-[300px]">
            <Ring share={buyShare} label={t('record_ring')} />
          </Reveal>
          <Reveal delay={120}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
              <Group name={t('record_buy')} g={r?.events.buy_trigger} after={t('record_after')} median={t('record_median')} nLabel={(n) => t('record_n', { n })} dot="bg-[#1E2A62]" />
              <Group name={t('record_burst')} g={r?.events.fomo_spike} after={t('record_after')} median={t('record_median')} nLabel={(n) => t('record_n', { n })} dot="bg-[#4E4EA3]" />
              <Group name={t('record_any')} g={r?.baseline} after={t('record_after')} median={t('record_median')} nLabel={(n) => t('record_n', { n })} dot="bg-[#8A99B4]" />
            </dl>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/whitepaper" className={buttonVariants({ variant: 'dark', size: 'lg', className: 'min-w-[220px] flex-1' })}>
                <FileText aria-hidden />
                {t('record_cta')}
              </Link>
              <Link
                href="/dashboard/strategy"
                className="inline-flex h-12 items-center rounded-md px-6 text-[15px] font-semibold text-black/80 ring-1 ring-inset ring-black/15 transition-colors hover:bg-black/5 hover:text-black"
              >
                {t('record_more')}
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Group({ name, g, after, median, nLabel, dot }: { name: string; g: GroupStats | undefined; after: string; median: string; nLabel: (n: number) => string; dot: string }) {
  const h = g?.horizons['4h'];
  const share = shareOf(h);
  const m = h && h.n >= 20 ? h.median_pct : null;
  return (
    <div>
      <dt className="flex items-center gap-2 text-sm text-black/60">
        <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
        {name}
      </dt>
      <dd className="num-display mt-1 text-2xl font-semibold tracking-[-0.02em]">{share == null ? '·' : `${Math.round(share * 100)}%`}</dd>
      <dd className="text-xs text-black/60">{after}</dd>
      <dd className="num-display mt-2 text-sm font-semibold">{m == null ? '·' : `${m > 0 ? '+' : ''}${m.toFixed(1)}%`}</dd>
      <dd className="text-xs text-black/60">{median}</dd>
      {h && <dd className="mt-1 text-xs text-black/50">{nLabel(h.n)}</dd>}
    </div>
  );
}

/** Ring split into "higher after 4h" and the rest, drawn as two arcs. */
function Ring({ share, label }: { share: number | null; label: string }) {
  const R = 80;
  const C = 2 * Math.PI * R;
  const on = share == null ? 0 : share * C;
  return (
    <figure className="relative">
      <svg viewBox="0 0 200 200" className="w-full -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#E3E8F0" strokeWidth="26" />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="#1E2A62"
          strokeWidth="26"
          strokeDasharray={`${on} ${C}`}
          className="transition-[stroke-dasharray] duration-[2000ms] ease-out"
        />
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="num-display text-4xl font-semibold tracking-[-0.03em]">{share == null ? '·' : `${Math.round(share * 100)}%`}</span>
        <span className="mt-1 max-w-[8rem] text-xs text-black/60">{label}</span>
      </figcaption>
    </figure>
  );
}
