'use client';

import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion/reveal';
import { CountUp } from '@/components/motion/count-up';
import { useLiveRows, useTrackRecord, shareOf } from '@/lib/live-data';
import { cn } from '@/lib/cn';

/** Bento of live facts, styled after the reference's stat cards. Every number comes from the API. */
export function LandingFacts() {
  const t = useTranslations('landing');
  const { data: live } = useLiveRows();
  const { data: tr } = useTrackRecord();
  const record = tr?.record ?? null;
  const days = record?.days ?? 7;
  const signals = record ? record.events.buy_trigger.n + record.events.sell_trigger.n + record.events.fomo_spike.n : null;
  const buy = shareOf(record?.events.buy_trigger.horizons['4h']);
  const any = shareOf(record?.baseline.horizons['4h']);

  return (
    <section id="facts" className="mx-auto max-w-[1100px] scroll-mt-10 px-5 py-24 sm:py-32">
      <Reveal className="text-center">
        <h2 className="text-display-lg">{t('facts_title')}</h2>
        <p className="mt-3 text-text-muted">{t('facts_sub')}</p>
      </Reveal>

      <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat delay={0} tone="slate" image="/fact-1.webp" value={live ? <CountUp value={live.rows.length} /> : null} label={t('fact_tracked')} />
        <Stat delay={80} tone="indigo" image="/fact-2.webp" value={signals != null ? <CountUp value={signals} /> : null} label={t('fact_signals', { days })} />
        <Stat delay={160} tone="gold" image="/fact-3.webp" value={<CountUp value={1440} />} label={t('fact_runs')} />
        <Stat delay={240} tone="green" image="/fact-4.webp" value={<CountUp value={12} />} label={t('fact_factors')} />

        <Reveal delay={120} className="col-span-2 rounded-xl bg-[linear-gradient(180deg,#FFFFFF,#E7ECF3)] p-6 text-bg-base sm:p-8 lg:col-span-4">
          <p className="text-display-md">{t('fact_compare_title')}</p>
          <div className="mt-6 space-y-4">
            <CompareBar label={t('fact_compare_buy')} share={buy} color="bg-[#1E2A62]" />
            <CompareBar label={t('fact_compare_any')} share={any} color="bg-[#8A99B4]" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const TONES = {
  slate: 'bg-[radial-gradient(620%_132%_at_10%_-15%,#758FA8_0%,#57718A_85%)]',
  indigo: 'bg-[radial-gradient(405%_322%_at_7%_-146%,#1E1E2A_0%,#2A2A56_33%,#4E4EA3_67%,#7C7CC7_100%)]',
  gold: 'bg-[linear-gradient(205deg,#F1BA4A_-12%,#A1B8C6_28%,#37526F_78%)]',
  green: 'bg-[linear-gradient(160deg,#1E5A47_0%,#2B7A62_55%,#5FA592_100%)]'
} as const;

function Stat({ value, label, tone, image, delay }: { value: React.ReactNode | null; label: string; tone: keyof typeof TONES; image: string; delay: number }) {
  return (
    <Reveal delay={delay} className={cn('relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-xl p-5 sm:min-h-[180px] sm:p-6', TONES[tone])}>
      {/* Decorative 3D render (Higgsfield); the number and label carry the content. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" width={640} height={480} loading="lazy" decoding="async" className="absolute bottom-0 right-0 h-[58%] w-[58%] object-cover sm:h-full sm:w-[78%] object-[85%_60%] [mask-image:radial-gradient(ellipse_at_68%_58%,black_30%,transparent_70%)] sm:[mask-image:linear-gradient(to_right,transparent,black_40%)]" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.1)_55%,transparent_75%)]" />
      <p className="relative text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-none tracking-[-0.03em]">
        {value ?? <span className="inline-block h-9 w-16 animate-pulse rounded bg-white/20" />}
      </p>
      <p className="relative max-w-[60%] text-[15px] leading-snug text-white/90">{label}</p>
    </Reveal>
  );
}

function CompareBar({ label, share, color }: { label: string; share: number | null; color: string }) {
  const pct = share == null ? null : Math.round(share * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-black/70">{label}</span>
        <span className="num-display text-xl font-semibold">{pct == null ? '·' : `${pct}%`}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-pill bg-black/[0.07]">
        <div
          className={cn('h-full origin-left rounded-pill transition-transform duration-[2000ms] ease-out', color)}
          style={{ transform: `scaleX(${pct == null ? 0 : pct / 100})` }}
        />
      </div>
    </div>
  );
}
