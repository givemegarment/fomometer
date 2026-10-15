import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/wordmark';
import { Button } from '@/components/ui/button';

export const runtime = 'edge';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark />
      <div className="num-display text-display-xl text-text-primary">404</div>
      <p className="max-w-md text-text-muted">{t('not_found')}</p>
      <Button asChild>
        <Link href="/">{t('go_home')}</Link>
      </Button>
    </main>
  );
}
