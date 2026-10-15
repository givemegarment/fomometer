import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/wordmark';
import { StatusBadge } from '@/components/status-badge';
import { PrimaryNav, SecondaryNav, MobileTabs } from '@/components/shell/nav-links';

const REPO_URL = 'https://github.com/givemegarment/fomometer';

/**
 * One frame for every page: a 48px top bar (product sections, reading links, status),
 * the page, and a status bar with data freshness, source and the disclaimer.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('site');
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <header className="sticky top-0 z-30 border-b border-border bg-bg-base/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1440px] items-stretch gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="FOMOMETER home" className="flex items-center">
            <Wordmark />
          </Link>
          <PrimaryNav className="ml-4 hidden md:flex" />
          <div className="ml-auto flex items-center gap-4">
            <SecondaryNav className="hidden lg:flex" />
            <StatusBadge />
          </div>
        </div>
        <MobileTabs />
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-text-dim sm:px-6">
          <StatusBadge detailed />
          <span>
            {t('data_source')}{' '}
            <a href="https://dexscreener.com" target="_blank" rel="noopener noreferrer" className="text-text-muted underline decoration-text-dim/50 underline-offset-2 hover:text-text-primary">
              DexScreener
            </a>
          </span>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-text-muted underline decoration-text-dim/50 underline-offset-2 hover:text-text-primary">
            {t('source_code')}
          </a>
          <span className="w-full sm:ml-auto sm:w-auto">{t('disclaimer_short')}</span>
        </div>
      </footer>
    </div>
  );
}
