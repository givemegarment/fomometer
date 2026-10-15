'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button-variants';
import { useNextRun } from '@/components/motion/next-run';
import { cn } from '@/lib/cn';

/** Floating pill (the reference's sticky countdown) once the hero has scrolled away. */
export function StickyCta() {
  const t = useTranslations('landing');
  const { secondsLeft } = useNextRun();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-[transform,opacity] duration-500 ease-snap',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      )}
      aria-hidden={!shown}
    >
      <div className="ring-hair flex items-center gap-4 rounded-xl bg-[#1B1B1D]/90 py-2 pl-4 pr-2 shadow-2xl backdrop-blur-xl">
        <p className="text-sm font-semibold">
          <span aria-hidden className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />
          {t('sticky_live')}
          <span className="num-display ml-2 font-normal text-text-muted">{secondsLeft != null && t('sticky_next', { s: secondsLeft % 60 })}</span>
        </p>
        <Link href="/dashboard" tabIndex={shown ? 0 : -1} className={buttonVariants({ size: 'md' })}>
          {t('nav_board')}
        </Link>
      </div>
    </div>
  );
}
