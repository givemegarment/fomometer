import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/cn';

type Step = { title: string; body: string };

/** 3D renders (Higgsfield, design/3d-brief.md), one per card; the CSS gradient shows above and while loading. */
const RENDERS = ['/step-1.webp', '/step-2.webp', '/step-3.webp', '/step-4.webp'] as const;

const CARDS = [
  'bg-[linear-gradient(180deg,#4A4C52_0%,#9A9CA2_100%)]',
  'bg-[linear-gradient(359deg,#889FD8_-29%,#3F5FA8_40%,#132362_97%)]',
  'bg-[linear-gradient(180deg,#F6E7D3_0%,#D9BE9C_100%)]',
  'bg-[linear-gradient(170deg,#1E5A47_0%,#2E7D66_60%,#8FC9B8_130%)]'
];

/** Four colored cards with a number chip and a 3D render each, after the reference's feature cards. */
export async function LandingSteps() {
  const t = await getTranslations('landing');
  const steps = t.raw('steps') as Step[];
  return (
    <section className="mx-auto max-w-[900px] px-5 py-24 sm:py-32">
      <Reveal className="text-center">
        <h2 className="text-display-lg">{t('steps_title')}</h2>
      </Reveal>
      <ol className="mt-12 grid gap-4 sm:grid-cols-2">
        {steps.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 80} className={cn('relative flex min-h-[340px] flex-col overflow-hidden rounded-2xl p-7', CARDS[i])}>
            {/* Decorative: the card's text says everything the picture shows. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RENDERS[i]} alt="" width={960} height={720} loading="lazy" decoding="async" className="absolute inset-x-0 bottom-0 h-[72%] w-full object-cover object-right-bottom [mask-image:linear-gradient(to_bottom,transparent,black_30%)]" />
            {/* Keeps the text readable wherever the object lands; the light card gets a light veil. */}
            <div
              aria-hidden
              className={cn(
                'absolute inset-0',
                i === 2
                  ? 'bg-[linear-gradient(to_bottom,rgba(246,231,211,0.85)_0%,rgba(246,231,211,0.4)_40%,transparent_65%)]'
                  : 'bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.15)_40%,transparent_65%)]'
              )}
            />
            <h3 className={cn('relative text-[28px] font-semibold leading-tight tracking-[-0.02em]', i === 2 && 'text-[#1C130A]')}>{s.title}</h3>
            <p className={cn('relative mt-3 max-w-[22rem] text-[15px] leading-relaxed', i === 2 ? 'text-[#1C130A]/80' : 'text-white/85')}>{s.body}</p>
            <span className="num-display absolute bottom-6 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-xs font-semibold text-white backdrop-blur">
              0{i + 1}
            </span>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
