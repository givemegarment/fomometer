import { NextResponse } from 'next/server';
import { getCF } from '@/lib/cf';
import { TRACKED_CTE } from '@/lib/freshness';

export const runtime = 'edge';

const BUY_WINDOW_SEC = 60 * 60;

export async function GET() {
  const cf = await getCF();
  if (!cf?.env.DB) {
    return NextResponse.json(empty());
  }

  // BUY signals in the last hour: same source (signal_events) as the "latest BUY" list.
  const cutoff = Math.floor(Date.now() / 1000) - BUY_WINDOW_SEC;
  const buyCountRow = await cf.env.DB.prepare(
    `SELECT COUNT(*) AS c FROM signal_events WHERE event_type = 'buy_trigger' AND time >= ?`
  )
    .bind(cutoff)
    .first<{ c: number }>();

  // Tracked tokens only: price from the latest snapshot, score from the latest signal.
  const avgRow = await cf.env.DB.prepare(
    `WITH ${TRACKED_CTE}
     SELECT AVG(s.score) AS s FROM ls
     JOIN signals s ON s.address = ls.address AND s.time = ls.t`
  ).first<{ s: number | null }>();

  const leadersRes = await cf.env.DB.prepare(
    `WITH ${TRACKED_CTE}
     SELECT t.address, COALESCE(t.symbol, '') AS symbol, t.image_url,
            s.score, sn.price_change_h24, sn.price_usd
     FROM tracked tr
     JOIN tokens t ON t.address = tr.address
     JOIN ls ON ls.address = tr.address
     JOIN signals s ON s.address = ls.address AND s.time = ls.t
     JOIN token_snapshots sn ON sn.address = tr.address AND sn.time = tr.st
     ORDER BY s.score DESC
     LIMIT 10`
  ).all<{
    address: string;
    symbol: string;
    image_url: string | null;
    score: number;
    price_change_h24: number | null;
    price_usd: number | null;
  }>();

  const buysRes = await cf.env.DB.prepare(
    `SELECT e.address, COALESCE(t.symbol, '') AS symbol, t.image_url, e.score, e.time
     FROM signal_events e
     LEFT JOIN tokens t ON t.address = e.address
     WHERE e.event_type = 'buy_trigger'
     ORDER BY e.time DESC
     LIMIT 10`
  ).all<{ address: string; symbol: string; image_url: string | null; score: number; time: number }>();

  return NextResponse.json({
    buy_signals_1h: buyCountRow?.c ?? 0,
    avg_score: avgRow?.s ?? null,
    leaders: leadersRes.results ?? [],
    last_buys: buysRes.results ?? []
  });
}

function empty() {
  return { buy_signals_1h: 0, avg_score: null, leaders: [], last_buys: [] };
}
