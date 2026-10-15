import { NextResponse } from 'next/server';
import { getCF } from '@/lib/cf';

export const runtime = 'edge';

/**
 * Data freshness for the LIVE / STALE badge.
 * snapshot_at: newest price snapshot (written every minute).
 * scored_at:   newest score (can lag when a scoring run fails).
 */
export async function GET() {
  const cf = await getCF();
  if (!cf?.env.DB) return NextResponse.json({ snapshot_at: null, scored_at: null });

  const row = await cf.env.DB.prepare(
    `SELECT (SELECT MAX(time) FROM token_snapshots) AS snapshot_at,
            (SELECT MAX(time) FROM signals) AS scored_at`
  ).first<{ snapshot_at: number | null; scored_at: number | null }>();

  return NextResponse.json(
    { snapshot_at: row?.snapshot_at ?? null, scored_at: row?.scored_at ?? null },
    { headers: { 'cache-control': 'public, max-age=20' } }
  );
}
