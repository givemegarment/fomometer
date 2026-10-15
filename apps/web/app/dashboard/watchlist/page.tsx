import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { WatchlistClient } from '@/components/dashboard/watchlist-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('watchlist') };
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function WatchlistPage() {
  return <WatchlistClient />;
}
