import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/wordmark';
import { StatusBadge } from '@/components/status-badge';
import { PrimaryNav, SecondaryNav, MobileTabs } from '@/components/shell/nav-links';
import { TokenLink, XLink } from '@/components/social-links';

/**
 * One frame for every dashboard page: a 48px top bar (product sections, reading links, status)
 * and the page. The disclaimer lives in the terms and the site footer.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('social');
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
            <TokenLink label={t('token')} className="hidden sm:inline-flex" />
            <XLink label={t('x')} className="-mx-2" />
            <StatusBadge />
          </div>
        </div>
        <MobileTabs />
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6">
        {children}
      </main>

    </div>
  );
}
