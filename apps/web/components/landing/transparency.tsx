import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { LiveBoard } from '@/components/landing/live-board';

/** Big rounded gradient stage (the reference's "Why" block) with the live top 5 inside. */
export async function LandingTransparency() {
  const t = await getTranslations('landing');
  return (
    <section className="px-3 sm:px-8">
      <div className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-3xl bg-[radial-gradient(405%_322%_at_7%_-146%,#1E1E2A_0%,#2A2A56_33%,#4E4EA3_67%,#7C7CC7_100%)] px-5 py-20 text-center sm:px-10 sm:py-24">
        {/* Decorative 3D backdrop (Higgsfield): glass panels at the edges, calm centre for the table. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stage.webp" alt="" width={1920} height={1080} loading="lazy" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.06em]">{t('open_kicker')}</p>
          <span className="ring-hair mt-4 inline-flex rounded-pill bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.04em]">
            {t('open_tag')}
          </span>
          <h2 className="mt-5 text-display-lg">{t('open_title')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">{t('open_sub')}</p>
        </Reveal>
        <Reveal delay={150} className="mx-auto mt-12 max-w-2xl">
          <LiveBoard />
        </Reveal>
      </div>
    </section>
  );
}
