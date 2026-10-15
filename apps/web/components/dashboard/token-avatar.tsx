'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

const SIZES = { sm: 'h-7 w-7 text-[11px]', md: 'h-8 w-8 text-xs', lg: 'h-12 w-12 text-base' } as const;
const PX = { sm: 28, md: 32, lg: 48 } as const;

/**
 * DexScreener CDN serves 800px logos by default (~100 KB). It only accepts a fixed
 * set of sizes (64, 128, 256 verified); pick the smallest one covering 2x density.
 */
function sized(src: string, px: number): string {
  try {
    const u = new URL(src);
    if (u.hostname.endsWith('dexscreener.com') && u.searchParams.has('width')) {
      const side = px * 2 <= 64 ? 64 : px * 2 <= 128 ? 128 : 256;
      u.searchParams.set('width', String(side));
      u.searchParams.set('height', String(side));
    }
    return u.toString();
  } catch {
    return src;
  }
}

/** Token logo from DexScreener; falls back to the first letter of the symbol. */
export function TokenAvatar({
  src,
  symbol,
  size = 'sm',
  className
}: {
  src: string | null | undefined;
  symbol: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const base = cn('shrink-0 rounded-full bg-bg-chip', SIZES[size], className);

  if (src && !failed) {
    return (
      // Plain <img>: the Next image optimizer is not available on Cloudflare Pages.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sized(src, PX[size])}
        alt=""
        width={PX[size]}
        height={PX[size]}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn(base, 'object-cover')}
      />
    );
  }

  return (
    <span aria-hidden className={cn(base, 'inline-flex items-center justify-center font-semibold text-text-muted')}>
      {(symbol || '?').replace(/^\$/, '').slice(0, 1).toUpperCase()}
    </span>
  );
}
