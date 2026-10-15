import { TokenDetailClient } from '@/components/dashboard/token-detail-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function TokenPage({ params }: { params: { address: string } }) {
  return <TokenDetailClient address={params.address} />;
}
