import { NextResponse } from 'next/server';
import { getCF } from '@/lib/cf';

export const runtime = 'edge';

const BUY_WINDOW_SEC = 60 * 60;

/**
 * BUY signals in the last hour (the board's fact strip). `+event_type` keeps SQLite on the
 * time index: about 12 rows read instead of every BUY event ever stored.
 */
export async function GET() {
  const cf = await getCF();
  if (!cf?.env.DB) return NextResponse.json({ buy_signals_1h: 0 });

  const cutoff = Math.floor(Date.now() / 1000) - BUY_WINDOW_SEC;
  const row = await cf.env.DB.prepare(
    `SELECT COUNT(*) AS c FROM signal_events WHERE time >= ? AND +event_type = 'buy_trigger'`
  )
    .bind(cutoff)
    .first<{ c: number }>();

  return NextResponse.json({ buy_signals_1h: row?.c ?? 0 });
}
