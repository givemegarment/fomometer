'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

/** Product sections. Token pages belong to the board. */
const PRIMARY = [
  { href: '/dashboard', key: 'board', match: (p: string) => p === '/dashboard' || p.startsWith('/dashboard/token') },
  { href: '/dashboard/signals', key: 'signals', match: (p: string) => p.startsWith('/dashboard/signals') },
  { href: '/dashboard/strategy', key: 'strategy', match: (p: string) => p.startsWith('/dashboard/strategy') },
  { href: '/dashboard/watchlist', key: 'watchlist', match: (p: string) => p.startsWith('/dashboard/watchlist') },
  { href: '/dashboard/treasury', key: 'treasury', match: (p: string) => p.startsWith('/dashboard/treasury') }
] as const;

/** Reading material, quieter than the product sections. */
const SECONDARY = [
  { href: '/how-it-works', key: 'method' },
  { href: '/whitepaper', key: 'whitepaper' },
  { href: '/roadmap', key: 'roadmap' }
] as const;

export function PrimaryNav({ className }: { className?: string }) {
  const path = usePathname();
  const t = useTranslations('nav');
  return (
    <nav aria-label={t('label')} className={cn('flex items-stretch', className)}>
      {PRIMARY.map((item) => {
        const active = item.match(path);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              // Keyboard focus as a soft fill, not the global outline: some browsers keep the
              // outline after a mouse click, which boxed the active tab.
              'relative flex items-center whitespace-nowrap rounded-md px-3 text-sm transition-colors focus-visible:bg-white/[0.06] focus-visible:outline-none',
              active ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {t(item.key)}
            {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function SecondaryNav({ className }: { className?: string }) {
  const path = usePathname();
  const t = useTranslations('nav');
  return (
    <nav aria-label={t('docs_label')} className={cn('flex items-center gap-1', className)}>
      {SECONDARY.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={path === item.href ? 'page' : undefined}
          className={cn(
            'whitespace-nowrap rounded px-2 py-1 text-[13px] transition-colors',
            path === item.href ? 'text-text-primary' : 'text-text-dim hover:text-text-primary'
          )}
        >
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile: every section in one horizontally scrolling row under the top bar. */
export function MobileTabs() {
  const path = usePathname();
  const t = useTranslations('nav');
  const items = [...PRIMARY.map((i) => ({ ...i, active: i.match(path) })), ...SECONDARY.map((i) => ({ ...i, active: path === i.href }))];
  return (
    <nav aria-label={t('label')} className="no-scrollbar flex h-10 items-stretch overflow-x-auto border-t border-border px-2 md:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'relative flex shrink-0 items-center px-3 text-[13px]',
            item.active ? 'text-text-primary' : 'text-text-muted'
          )}
        >
          {t(item.key)}
          {item.active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
        </Link>
      ))}
    </nav>
  );
}
