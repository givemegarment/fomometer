'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button-variants';
import { useNextRun } from '@/components/motion/next-run';
import { cn } from '@/lib/cn';
import { TOKEN_LAUNCHED, TOKEN_SYMBOL, TOKEN_URL } from '@/lib/token';

/** After this long without a run the countdown would be fiction; show the stale note instead. */
const STALE_AFTER_SEC = 180;

/**
 * Full-height hero: a 3D render of the brand's meter (glass bars, the tallest green) behind a
 * centered title, a countdown to the next scoring run with a filling bar, and the way into the board.
 */
export function LandingHero() {
  const t = useTranslations('landing');
  const { secondsLeft, progress, lastRun } = useNextRun();
  const stale = lastRun != null && Date.now() / 1000 - lastRun > STALE_AFTER_SEC;

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-24 pt-24 text-center">
      <Backdrop />

      <span className="ring-hair inline-flex items-center gap-2 rounded-pill bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium backdrop-blur">
        <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', stale ? 'bg-warning' : 'animate-pulse bg-accent')} />
        {stale ? t('stale') : t('live')} · {t('chain')}
      </span>
      {TOKEN_LAUNCHED && (
        <a
          href={TOKEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-[13px] font-medium text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline"
        >
          {t('token_live', { symbol: TOKEN_SYMBOL })}
        </a>
      )}

      <h1 className="mt-6 text-display-2xl">{t('title')}</h1>
      <p className="mt-4 max-w-xl text-lg text-white/80">{t('subtitle')}</p>

      <div className="mt-8 w-full max-w-md">
        {stale ? (
          <p className="text-sm text-warning">{t('stale_note')}</p>
        ) : (
          <>
            <span className="ring-hair inline-flex rounded-pill px-3 py-1 text-[13px] text-white/90">{t('next_run')}</span>
            <p className="num-display mt-2 text-5xl font-semibold tracking-[-0.03em]" aria-live="off">
              00:{secondsLeft == null ? '··' : String(secondsLeft).padStart(2, '0')}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-pill bg-white/10">
              <div
                className="h-full origin-left rounded-pill bg-gradient-to-r from-[#CAC398] via-[#EAEDEC] to-[#00B24B] transition-transform duration-300 ease-linear"
                style={{ transform: `scaleX(${progress ?? 0})` }}
              />
            </div>
          </>
        )}

        <div className="ring-hair mt-5 rounded-2xl bg-[#1B1B1D]/80 p-4 backdrop-blur-md">
          <p className="text-[15px] text-text-muted">{t('hero_card')}</p>
          <Link href="/dashboard" className={buttonVariants({ size: 'lg', className: 'mt-3 w-full' })}>
            {t('nav_board')}
          </Link>
        </div>
      </div>

      <a href="#facts" className="group absolute bottom-8 left-5 hidden items-center gap-3 text-[15px] text-text-muted sm:left-10 sm:flex [@media(max-height:940px)]:!hidden">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-bg-base">
          <ArrowDown className="h-4 w-4 animate-nudge-down" aria-hidden />
        </span>
        <span className="transition-colors group-hover:text-text-primary">{t('scroll')}</span>
      </a>
    </section>
  );
}

/**
 * Render from design/renders/hero-v1.png (Higgsfield, FLUX.2 Max), served as webp in two widths.
 * Darkened at the top and behind the centre so the title and countdown stay readable; a slow
 * zoom stands in for the reference's video background (off with reduced motion).
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <picture>
        <source media="(max-width: 767px)" srcSet="/hero-meter-960.webp" />
        <img
          src="/hero-meter.webp"
          alt=""
          width={1920}
          height={1088}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full animate-breathe object-cover object-[50%_80%] opacity-80 motion-reduce:animate-none"
        />
      </picture>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#141415_0%,rgba(20,20,21,0.85)_28%,rgba(20,20,21,0.35)_60%,rgba(20,20,21,0.2)_80%,#141415_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_50%_58%,rgba(20,20,21,0.75),transparent_75%)]" />
    </div>
  );
}
