import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OverviewClient } from '@/components/dashboard/overview-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('overview') };
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function DashboardOverviewPage() {
  return <OverviewClient />;
}
