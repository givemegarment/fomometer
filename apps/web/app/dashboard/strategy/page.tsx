import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StrategyClient } from '@/components/dashboard/strategy-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('strategy') };
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function StrategyPage() {
  return <StrategyClient />;
}
