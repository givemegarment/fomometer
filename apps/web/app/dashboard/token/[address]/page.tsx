import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TokenDetailClient } from '@/components/dashboard/token-detail-client';
import { getCF } from '@/lib/cf';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^[A-Za-z0-9]{20,64}$/;

/** Tab title with the ticker ("BONK score · FOMOMETER"); one indexed lookup in tokens. */
export async function generateMetadata({ params }: { params: { address: string } }): Promise<Metadata> {
  const t = await getTranslations('token_detail');
  if (!ADDRESS_RE.test(params.address)) return {};
  const cf = await getCF();
  const row = await cf?.env.DB?.prepare('SELECT symbol FROM tokens WHERE address = ?').bind(params.address).first<{ symbol: string | null }>();
  return row?.symbol ? { title: t('meta_title', { symbol: row.symbol }) } : {};
}

export default function TokenPage({ params }: { params: { address: string } }) {
  return <TokenDetailClient address={params.address} />;
}
