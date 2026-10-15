'use client';

import { useTranslations } from 'next-intl';
import { Link2 } from 'lucide-react';
import { solscanTx } from '@/lib/chain';

/** Small link to the memo transaction that recorded this signal on Solana; nothing when it has none. */
export function ChainLink({ sig }: { sig: string | null | undefined }) {
  const t = useTranslations('chain');
  if (!sig) return null;
  return (
    <a
      href={solscanTx(sig)}
      target="_blank"
      rel="noopener noreferrer"
      title={t('link')}
      aria-label={t('link')}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-text-dim hover:text-accent"
    >
      <Link2 className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}
