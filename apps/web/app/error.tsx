'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t('error')}</h1>
      <p className="max-w-md text-text-muted">{t('error_body')}</p>
      <div className="flex gap-3">
        <Button onClick={reset}>{t('retry')}</Button>
        <Button asChild variant="ghost">
          <Link href="/">{t('go_home')}</Link>
        </Button>
      </div>
    </main>
  );
}
