import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/wordmark';

const REPO_URL = 'https://github.com/givemegarment/fomometer';

/** Multi-column footer after the reference: brand and disclaimer, then link columns. */
export async function SiteFooter() {
  const t = await getTranslations('landing');
  const tNav = await getTranslations('nav');
  const tSite = await getTranslations('site');
  const col = 'space-y-2.5 text-sm';
  const link = 'text-text-muted transition-colors hover:text-text-primary';
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 sm:px-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Wordmark />
          <p className="max-w-sm text-sm leading-relaxed text-text-muted">{tSite('disclaimer')}</p>
        </div>
        <nav aria-label={t('footer_product')}>
          <p className="mb-4 text-sm font-semibold">{t('footer_product')}</p>
          <ul className={col}>
            <li><Link className={link} href="/dashboard">{tNav('board')}</Link></li>
            <li><Link className={link} href="/dashboard/signals">{tNav('signals')}</Link></li>
            <li><Link className={link} href="/dashboard/strategy">{tNav('strategy')}</Link></li>
            <li><Link className={link} href="/dashboard/watchlist">{tNav('watchlist')}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t('footer_learn')}>
          <p className="mb-4 text-sm font-semibold">{t('footer_learn')}</p>
          <ul className={col}>
            <li><Link className={link} href="/how-it-works">{tNav('method')}</Link></li>
            <li><Link className={link} href="/whitepaper">{tNav('whitepaper')}</Link></li>
            <li><Link className={link} href="/roadmap">{tNav('roadmap')}</Link></li>
          </ul>
        </nav>
        <div>
          <p className="mb-4 text-sm font-semibold">{t('footer_open')}</p>
          <ul className={col}>
            <li><a className={link} href={REPO_URL} target="_blank" rel="noopener noreferrer">{t('footer_github')}</a></li>
            <li><a className={link} href="https://dexscreener.com" target="_blank" rel="noopener noreferrer">DexScreener</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-[1440px] px-5 py-5 text-xs text-text-dim sm:px-10">© {new Date().getFullYear()} {t('footer_rights')}</p>
      </div>
    </footer>
  );
}
