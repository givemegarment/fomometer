'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button-variants';
import { useNextRun } from '@/components/motion/next-run';
import { useLiveRows } from '@/lib/live-data';
import { cn } from '@/lib/cn';

/** Scores at or above this read as "hot" in the skyline (the engine's default BUY level). */
const HOT = 0.7;
/** After this long without a run the countdown would be fiction; show the stale note instead. */
const STALE_AFTER_SEC = 180;

/**
 * Full-height hero: the live "skyline" of every tracked token's score behind a centered
 * title, a countdown to the next scoring run with a filling bar, and the way into the board.
 */
export function LandingHero() {
  const t = useTranslations('landing');
  const { secondsLeft, progress, lastRun } = useNextRun();
  const { data } = useLiveRows();
  const stale = lastRun != null && Date.now() / 1000 - lastRun > STALE_AFTER_SEC;

  // Stable positions: order by address, so a bar only changes height between runs.
  const bars = useMemo(
    () => [...(data?.rows ?? [])].sort((a, b) => a.address.localeCompare(b.address)).map((r) => r.score ?? 0),
    [data]
  );

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-24 pt-24 text-center">
      <Skyline scores={bars} />

      <span className="ring-hair inline-flex items-center gap-2 rounded-pill bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium backdrop-blur">
        <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', stale ? 'bg-warning' : 'animate-pulse bg-accent')} />
        {stale ? t('stale') : t('live')} · {t('chain')}
      </span>

      <h1 className="mt-6 text-display-2xl">{t('title')}</h1>
      <p className="mt-4 max-w-xl text-lg text-white/80">{t('subtitle')}</p>

      <div className="mt-8 w-full max-w-md">
        {stale ? (
          <p className="text-sm text-warning">{t('stale_note')}</p>
        ) : (
          <>
            <span className="ring-hair inline-flex rounded-pill px-3 py-1 text-[13px] text-white/90">{t('next_run')}</span>
            <p className="num-display mt-2 text-5xl font-semibold tracking-[-0.03em]" aria-live="off">
              00:{secondsLeft == null ? '··' : String(secondsLeft % 60).padStart(2, '0')}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-pill bg-white/10">
              <div
                className="h-full origin-left rounded-pill bg-gradient-to-r from-[#CAC398] via-[#EAEDEC] to-[#00B24B] transition-transform duration-300 ease-linear"
                style={{ transform: `scaleX(${progress ?? 0})` }}
              />
            </div>
          </>
        )}

        <div className="ring-hair mt-5 rounded-2xl bg-white/[0.05] p-4 backdrop-blur-md">
          <p className="text-[15px] text-text-muted">{t('hero_card')}</p>
          <Link href="/dashboard" className={buttonVariants({ size: 'lg', className: 'mt-3 w-full' })}>
            {t('nav_board')}
            <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>

      <a href="#facts" className="group absolute bottom-8 left-5 hidden items-center gap-3 text-[15px] text-text-muted sm:left-10 sm:flex [@media(max-height:940px)]:!hidden">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-bg-base">
          <ArrowDown className="h-4 w-4 animate-nudge-down" aria-hidden />
        </span>
        <span className="transition-colors group-hover:text-text-primary">{t('scroll')}</span>
      </a>
      <p className="absolute bottom-8 right-5 hidden max-w-[16rem] text-right text-xs text-text-dim sm:right-10 lg:block [@media(max-height:940px)]:!hidden">{t('skyline_note')}</p>
    </section>
  );
}

/** One bar per tracked token; height = score. Fades into the page at the edges and the top. */
function Skyline({ scores }: { scores: number[] }) {
  const slots = scores.length ? scores : Array.from({ length: 32 }, () => 0.05);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(42,42,86,0.55),transparent_70%)]" />
      <div
        className="absolute inset-x-0 bottom-0 flex h-[52%] items-end gap-[0.8%] px-[2%] [mask-image:linear-gradient(to_top,black_10%,transparent_95%),linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] [mask-composite:intersect]"
      >
        {slots.map((s, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-t-[6px] transition-[height] duration-[850ms] ease-snap',
              s >= HOT
                ? 'bg-gradient-to-t from-[#00B24B]/5 to-[#00B24B]/45 shadow-[0_0_28px_rgba(0,178,75,0.25)]'
                : 'bg-gradient-to-t from-white/[0.01] to-white/[0.09]'
            )}
            style={{ height: `${Math.max(4, s * 100)}%` }}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg-base to-transparent" />
    </div>
  );
}
