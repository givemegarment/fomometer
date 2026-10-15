import { NextResponse, type NextRequest } from 'next/server';
import { getCF } from '@/lib/cf';

export const runtime = 'edge';

const TYPES = { buy: 'buy_trigger', sell: 'sell_trigger', fomo: 'fomo_spike' } as const;

export async function GET(req: NextRequest) {
  const cf = await getCF();
  if (!cf?.env.DB) return NextResponse.json({ events: [] });

  const typeParam = req.nextUrl.searchParams.get('type') as keyof typeof TYPES | null;
  const type = typeParam && typeParam in TYPES ? TYPES[typeParam] : null;
  const limit = Math.min(200, Math.max(20, parseInt(req.nextUrl.searchParams.get('limit') || '100', 10) || 100));

  const sql = `
    SELECT e.id, e.address, COALESCE(t.symbol,'') AS symbol, t.image_url, e.time, e.event_type,
           e.score, e.prev_score
    FROM signal_events e
    LEFT JOIN tokens t ON t.address = e.address
    ${type ? 'WHERE e.event_type = ?' : ''}
    ORDER BY e.id DESC
    LIMIT ?
  `;
  const stmt = type ? cf.env.DB.prepare(sql).bind(type, limit) : cf.env.DB.prepare(sql).bind(limit);

  const r = await stmt.all<{
    id: number;
    address: string;
    symbol: string;
    image_url: string | null;
    time: number;
    event_type: 'buy_trigger' | 'sell_trigger' | 'fomo_spike';
    score: number;
    prev_score: number | null;
  }>();

  return NextResponse.json({ events: r.results ?? [] });
}
