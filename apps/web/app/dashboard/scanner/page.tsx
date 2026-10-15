import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ScannerClient } from '@/components/dashboard/scanner-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('scanner') };
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function ScannerPage() {
  return <ScannerClient />;
}
