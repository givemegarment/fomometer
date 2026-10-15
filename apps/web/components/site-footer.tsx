import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/wordmark';
import { FEE_PCT, TRADING_ENABLED } from '@/lib/trade';

const REPO_URL = 'https://github.com/givemegarment/fomometer';

/** Multi-column footer after the reference: brand and disclaimer, then link columns. */
export async function SiteFooter() {
  const t = await getTranslations('landing');
  const tNav = await getTranslations('nav');
  const tSite = await getTranslations('site');
  const tLegal = await getTranslations('legal');
  const col = 'space-y-2.5 text-sm';
  const link = 'text-text-muted transition-colors hover:text-text-primary';
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 sm:px-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Wordmark />
          <p className="max-w-sm text-sm leading-relaxed text-text-muted">
            {tSite('disclaimer')}
            {TRADING_ENABLED && <> {tSite('disclaimer_trade', { fee: FEE_PCT })}</>}
          </p>
        </div>
        <nav aria-label={t('footer_product')}>
          <p className="mb-4 text-sm font-semibold">{t('footer_product')}</p>
          <ul className={col}>
            <li><Link className={link} href="/dashboard">{tNav('board')}</Link></li>
            <li><Link className={link} href="/dashboard/signals">{tNav('signals')}</Link></li>
            <li><Link className={link} href="/dashboard/strategy">{tNav('strategy')}</Link></li>
            <li><Link className={link} href="/dashboard/watchlist">{tNav('watchlist')}</Link></li>
            <li><Link className={link} href="/dashboard/treasury">{tNav('treasury')}</Link></li>
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
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-5 text-xs text-text-dim sm:px-10">
          <p>© {new Date().getFullYear()} {t('footer_rights')}</p>
          <p className="flex gap-5">
            <Link className="hover:text-text-primary" href="/terms">{tLegal('footer_terms')}</Link>
            <Link className="hover:text-text-primary" href="/privacy">{tLegal('footer_privacy')}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
