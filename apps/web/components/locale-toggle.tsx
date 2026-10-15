'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';

export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(next: 'en' | 'ru') {
    if (next === locale) return;
    document.cookie = `LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t('language')}
      className={cn(
        'flex items-center rounded-pill border border-border bg-bg-card p-0.5 text-xs',
        pending && 'opacity-70'
      )}
    >
      {(['en', 'ru'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          lang={l}
          onClick={() => set(l)}
          className={cn(
            'rounded-pill px-2.5 py-1 uppercase transition-colors',
            locale === l ? 'bg-accent text-bg-base' : 'text-text-muted hover:text-text-primary'
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
