import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

const ITEMS = ['advice', 'universe', 'stats', 'risk'] as const;

export async function LandingLimits() {
  const t = await getTranslations('landing');
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="limits-title">
      <div className="rounded-lg border border-border bg-bg-card p-6 sm:p-8">
        <h2 id="limits-title" className="text-2xl font-semibold tracking-tight">
          {t('limits_title')}
        </h2>
        <ul className="mt-5 grid gap-x-10 gap-y-3 text-sm text-text-muted md:grid-cols-2">
          {ITEMS.map((key) => (
            <li key={key} className="flex gap-3">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
              {t(`limits.${key}`)}
            </li>
          ))}
        </ul>
        <Link href="/how-it-works" className="mt-6 inline-block text-sm text-accent hover:underline">
          {t('limits_more')}
        </Link>
      </div>
    </section>
  );
}
