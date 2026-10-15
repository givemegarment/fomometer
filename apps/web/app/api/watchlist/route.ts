import { NextResponse, type NextRequest } from 'next/server';
import { getCF } from '@/lib/cf';

export const runtime = 'edge';

const MAX_ADDRESSES = 50;
// Same address shape as /api/tokens/[address].
const ADDRESS_RE = /^[A-Za-z0-9]{20,64}$/;

/**
 * GET /api/watchlist?addresses=a,b,c
 * The watchlist itself lives in the visitor's browser; this endpoint only
 * returns market data for the given addresses, in the order they were passed.
 */
export async function GET(req: NextRequest) {
  const addresses = (req.nextUrl.searchParams.get('addresses') || '')
    .split(',')
    .map((a) => a.trim())
    .filter((a) => ADDRESS_RE.test(a))
    .slice(0, MAX_ADDRESSES);

  const cf = await getCF();
  if (!cf?.env.DB || !addresses.length) return NextResponse.json({ rows: [] });

  const placeholders = addresses.map(() => '?').join(',');
  const r = await cf.env.DB.prepare(
    `SELECT t.address, COALESCE(t.symbol,'') AS symbol, COALESCE(t.name,'') AS name, t.image_url,
            sn.price_usd, sn.price_change_h24,
            (SELECT score FROM signals WHERE address = t.address ORDER BY time DESC LIMIT 1) AS score
     FROM tokens t
     LEFT JOIN token_snapshots sn ON sn.address = t.address
       AND sn.time = (SELECT MAX(time) FROM token_snapshots WHERE address = t.address)
     WHERE t.address IN (${placeholders})`
  )
    .bind(...addresses)
    .all<{
      address: string;
      symbol: string;
      name: string;
      image_url: string | null;
      price_usd: number | null;
      price_change_h24: number | null;
      score: number | null;
    }>();

  const byAddress = new Map((r.results ?? []).map((row) => [row.address, row]));
  const rows = addresses.flatMap((a) => {
    const row = byAddress.get(a);
    return row ? [row] : [];
  });

  return NextResponse.json({ rows });
}
