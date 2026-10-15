'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

const SIZES = { sm: 'h-7 w-7 text-[11px]', md: 'h-8 w-8 text-xs', lg: 'h-12 w-12 text-base' } as const;
const PX = { sm: 28, md: 32, lg: 48 } as const;

/**
 * DexScreener CMS logos are served through /api/logo (no third-party cookie, 64-256 px
 * instead of the 800 px default). The CDN only accepts 64, 128 and 256; pick the smallest
 * covering 2x density. Any other URL is used as is.
 */
function logoSrc(src: string, px: number): string {
  try {
    const u = new URL(src);
    const m = u.hostname === 'cdn.dexscreener.com' ? /^\/cms\/images\/([A-Za-z0-9_-]{6,64})$/.exec(u.pathname) : null;
    if (!m) return src;
    const side = px * 2 <= 64 ? 64 : px * 2 <= 128 ? 128 : 256;
    return `/api/logo/${m[1]}?s=${side}`;
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
        src={logoSrc(src, PX[size])}
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
