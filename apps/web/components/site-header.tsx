import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/wordmark';
import { LocaleToggle } from '@/components/locale-toggle';

/** Header for public pages (landing, how it works, whitepaper, roadmap). */
export async function SiteHeader() {
  const t = await getTranslations('site');
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="FOMOMETER">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-4">
          <Link href="/how-it-works" className="hidden px-2 py-1 text-text-muted hover:text-text-primary sm:inline">
            {t('how_it_works')}
          </Link>
          <Link href="/whitepaper" className="hidden px-2 py-1 text-text-muted hover:text-text-primary md:inline">
            {t('whitepaper')}
          </Link>
          <Link href="/dashboard" className="px-2 py-1 text-text-muted hover:text-text-primary">
            {t('dashboard')}
          </Link>
          <LocaleToggle />
        </nav>
      </div>
    </header>
  );
}
