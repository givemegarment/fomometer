import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SignalsClient } from '@/components/dashboard/signals-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('signals') };
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function SignalsPage() {
  return <SignalsClient />;
}
