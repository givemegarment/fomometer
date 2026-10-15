import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Info } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Wordmark } from '@/components/wordmark';

export async function TopBar() {
  const t = await getTranslations('site');
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-bg-base/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="md:hidden" aria-label="FOMOMETER">
          <Wordmark className="text-[13px]" />
        </Link>
        <StatusBadge detailed />
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/how-it-works"
          className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-text-muted hover:text-text-primary md:hidden"
          aria-label={t('how_it_works')}
        >
          <Info className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
