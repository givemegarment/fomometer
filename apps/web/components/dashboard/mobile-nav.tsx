'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  ScanSearch,
  Activity,
  BookText,
  Star
} from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/dashboard', label: 'overview', Icon: LayoutDashboard },
  { href: '/dashboard/scanner', label: 'scanner', Icon: ScanSearch },
  { href: '/dashboard/signals', label: 'signals', Icon: Activity },
  { href: '/dashboard/strategy', label: 'strategy', Icon: BookText },
  { href: '/dashboard/watchlist', label: 'watchlist', Icon: Star }
] as const;

export function MobileNav() {
  const path = usePathname();
  const t = useTranslations('nav');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-bg-base/90 px-2 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)', paddingTop: 8 }}
    >
      <ul className="grid grid-cols-5">
        {NAV.map((item) => {
          const active =
            path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors',
                  active ? 'text-accent' : 'text-text-muted'
                )}
              >
                <item.Icon className="h-5 w-5" aria-hidden />
                <span className="truncate">
                  {t(item.label)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
