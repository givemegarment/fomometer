import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage } from '@/components/docs/legal-page';

export const runtime = 'edge';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.terms');
  return { title: t('title'), description: t('meta_description') };
}

export default function Page() {
  return <LegalPage page="terms" />;
}
