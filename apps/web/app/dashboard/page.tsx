import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BoardClient } from '@/components/board/board-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('board') };
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function BoardPage() {
  return <BoardClient />;
}
