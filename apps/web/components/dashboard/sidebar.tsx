'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  ScanSearch,
  Activity,
  BookText,
  Star,
  Info
} from 'lucide-react';
import { Wordmark } from '@/components/wordmark';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/dashboard', label: 'overview', Icon: LayoutDashboard },
  { href: '/dashboard/scanner', label: 'scanner', Icon: ScanSearch },
  { href: '/dashboard/signals', label: 'signals', Icon: Activity },
  { href: '/dashboard/strategy', label: 'strategy', Icon: BookText },
  { href: '/dashboard/watchlist', label: 'watchlist', Icon: Star }
] as const;

export function Sidebar() {
  const path = usePathname();
  const t = useTranslations('nav');
  const tSite = useTranslations('site');

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-bg-card md:block">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center px-5">
          <Link href="/" aria-label="FOMOMETER">
            <Wordmark />
          </Link>
        </div>
        <nav className="flex-1 px-3">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-bg-elev text-text-primary'
                        : 'text-text-muted hover:bg-bg-elev/50 hover:text-text-primary'
                    )}
                  >
                    <item.Icon
                      aria-hidden
                      className={cn(
                        'h-4 w-4',
                        active ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'
                      )}
                    />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="space-y-3 border-t border-border p-4">
          <Link
            href="/how-it-works"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-elev/50 hover:text-text-primary"
          >
            <Info className="h-4 w-4" aria-hidden />
            {tSite('how_it_works')}
          </Link>
          <p className="px-3 text-xs text-text-dim">{tSite('data_source')} DexScreener</p>
        </div>
      </div>
    </aside>
  );
}
