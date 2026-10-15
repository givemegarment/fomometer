import { NextResponse, type NextRequest } from 'next/server';
import { getCF } from '@/lib/cf';
import { TRACKED_CTE } from '@/lib/freshness';

export const runtime = 'edge';

const SPARK_POINTS = 30; // last 30 snapshots ≈ last 30 minutes

export async function GET(req: NextRequest) {
  const cf = await getCF();
  if (!cf?.env.DB) return NextResponse.json({ rows: [] });

  const filter = req.nextUrl.searchParams.get('filter');
  const limit = Math.min(50, Math.max(10, parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)));

  // Tracked tokens: price from the latest snapshot, score from the latest signal.
  let extraFilter = '';
  if (filter === 'score') extraFilter = ' AND s.score >= 0.7';
  else if (filter === 'liq') extraFilter = ' AND sn.liquidity_usd >= 50000';
  else if (filter === 'fomo') extraFilter = ` AND CAST(json_extract(s.factors_json, '$.fomo') AS REAL) >= 2.0`;

  const sql = `
    WITH ${TRACKED_CTE}
    SELECT t.address, COALESCE(t.symbol, '') AS symbol, COALESCE(t.name, '') AS name,
           t.image_url, sn.price_usd, sn.price_change_h24,
           sn.liquidity_usd, sn.fdv,
           CAST(json_extract(s.factors_json, '$.fomo') AS REAL) AS fomo_factor,
           s.score, s.time AS scored_at
    FROM tracked tr
    JOIN tokens t ON t.address = tr.address
    JOIN ls ON ls.address = tr.address
    JOIN signals s ON s.address = ls.address AND s.time = ls.t
    JOIN token_snapshots sn ON sn.address = tr.address AND sn.time = tr.st
    WHERE 1=1 ${extraFilter}
    ORDER BY s.score DESC
    LIMIT ${limit}
  `;

  const r = await cf.env.DB.prepare(sql).all<{
    address: string;
    symbol: string;
    name: string;
    image_url: string | null;
    price_usd: number | null;
    price_change_h24: number | null;
    liquidity_usd: number | null;
    fdv: number | null;
    fomo_factor: number | null;
    score: number;
    scored_at: number;
  }>();
  const rows = r.results ?? [];

  // Sparklines: fetch last N snapshots for each address (parallel).
  const since = Math.floor(Date.now() / 1000) - SPARK_POINTS * 60;
  const sparks = await Promise.all(
    rows.map(async (row) => {
      const sr = await cf!
        .env.DB.prepare(
          `SELECT price_usd FROM token_snapshots WHERE address = ? AND time >= ? ORDER BY time ASC`
        )
        .bind(row.address, since)
        .all<{ price_usd: number }>();
      return (sr.results ?? []).map((x) => x.price_usd);
    })
  );

  return NextResponse.json({
    rows: rows.map((row, i) => ({
      ...row,
      spark: sparks[i] ?? []
    }))
  });
}
