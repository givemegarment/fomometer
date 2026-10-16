import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/wordmark';
import { buttonVariants } from '@/components/ui/button-variants';
import { GitHubLink, TokenLink, XLink } from '@/components/social-links';

/**
 * Public pages header, like the reference: mark left, quiet links, one green button right.
 * `overlay` floats it over the landing hero; elsewhere it sits on the page with a hairline.
 */
export async function SiteNav({ overlay = false }: { overlay?: boolean }) {
  const t = await getTranslations('landing');
  const tNav = await getTranslations('nav');
  const tSocial = await getTranslations('social');
  return (
    <header className={overlay ? 'absolute inset-x-0 top-0 z-30' : 'relative z-30 border-b border-border'}>
      <div className="mx-auto flex h-20 max-w-[1440px] items-center gap-6 px-5 sm:px-10">
        <Link href="/" aria-label="FOMOMETER home">
          <Wordmark />
        </Link>
        <nav aria-label={tNav('docs_label')} className="ml-auto hidden items-center gap-6 text-sm text-text-muted md:flex">
          <Link href="/how-it-works" className="transition-colors hover:text-text-primary">{tNav('method')}</Link>
          <Link href="/whitepaper" className="transition-colors hover:text-text-primary">{tNav('whitepaper')}</Link>
          <Link href="/roadmap" className="transition-colors hover:text-text-primary">{tNav('roadmap')}</Link>
          <TokenLink label={tSocial('token')} />
        </nav>
        <div className="ml-auto flex items-center md:ml-0">
          <GitHubLink label={tSocial('github')} />
          <XLink label={tSocial('x')} />
        </div>
        <Link href="/dashboard" className={buttonVariants({ size: 'md' })}>
          {t('nav_board')}
        </Link>
      </div>
    </header>
  );
}
