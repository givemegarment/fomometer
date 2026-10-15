import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TreasuryClient } from '@/components/dashboard/treasury-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('treasury');
  return { title: t('title'), description: t('meta_description') };
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function TreasuryPage() {
  return <TreasuryClient />;
}
