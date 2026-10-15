import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/wordmark';

export async function SiteFooter() {
  const t = await getTranslations('site');
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <Wordmark />
          <p className="max-w-xl text-sm text-text-muted">{t('disclaimer')}</p>
          <p className="text-xs text-text-dim">
            {t('data_source')}{' '}
            <a
              href="https://dexscreener.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted underline underline-offset-2 hover:text-text-primary"
            >
              DexScreener
            </a>
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:flex-col md:gap-2 md:text-right">
          <Link href="/dashboard" className="text-text-muted hover:text-text-primary">
            {t('dashboard')}
          </Link>
          <Link href="/how-it-works" className="text-text-muted hover:text-text-primary">
            {t('how_it_works')}
          </Link>
          <Link href="/whitepaper" className="text-text-muted hover:text-text-primary">
            {t('whitepaper')}
          </Link>
          <Link href="/roadmap" className="text-text-muted hover:text-text-primary">
            {t('roadmap')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
