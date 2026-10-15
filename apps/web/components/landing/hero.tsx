import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveBoard } from '@/components/landing/live-board';

export async function LandingHero() {
  const t = await getTranslations('landing');
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
      <div>
        <p className="text-sm text-text-muted">{t('eyebrow')}</p>
        <h1 className="mt-3 max-w-3xl text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-text-muted sm:text-lg">
          {t('subtitle')}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">
              {t('cta_open')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/how-it-works">{t('cta_how')}</Link>
          </Button>
        </div>
      </div>
      <LiveBoard />
    </section>
  );
}
