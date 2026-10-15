import { NextResponse } from 'next/server';
import { getCF } from '@/lib/cf';

export const runtime = 'edge';

const HISTORY_HOURS = 6;

export async function GET(
  _req: Request,
  { params }: { params: { address: string } }
) {
  const cf = await getCF();
  if (!cf?.env.DB) return NextResponse.json({ error: 'no_db' }, { status: 503 });

  const address = params.address;
  if (!/^[A-Za-z0-9]{20,64}$/.test(address)) {
    return NextResponse.json({ error: 'bad_address' }, { status: 400 });
  }

  const since = Math.floor(Date.now() / 1000) - HISTORY_HOURS * 3600;

  const tokenRow = await cf.env.DB.prepare(
    `SELECT t.address, COALESCE(t.symbol,'') AS symbol, COALESCE(t.name,'') AS name, t.image_url, t.pair_address,
            sn.price_usd, sn.price_change_h24, sn.liquidity_usd, sn.fdv
     FROM tokens t
     LEFT JOIN (
       SELECT address, MAX(time) AS t FROM token_snapshots GROUP BY address
     ) lt ON lt.address = t.address
     LEFT JOIN token_snapshots sn ON sn.address = t.address AND sn.time = lt.t
     WHERE t.address = ?`
  )
    .bind(address)
    .first<{
      address: string;
      symbol: string;
      name: string;
      image_url: string | null;
      pair_address: string | null;
      price_usd: number | null;
      price_change_h24: number | null;
      liquidity_usd: number | null;
      fdv: number | null;
    }>();

  const histRes = await cf.env.DB.prepare(
    `SELECT sn.time, sn.price_usd AS price, s.score
     FROM token_snapshots sn
     LEFT JOIN signals s ON s.address = sn.address AND s.time = sn.time
     WHERE sn.address = ? AND sn.time >= ?
     ORDER BY sn.time ASC`
  )
    .bind(address, since)
    .all<{ time: number; price: number; score: number | null }>();

  const latestSig = await cf.env.DB.prepare(
    `SELECT factors_json FROM signals WHERE address = ? ORDER BY time DESC LIMIT 1`
  )
    .bind(address)
    .first<{ factors_json: string }>();

  let factors: number[] = new Array(12).fill(0);
  if (latestSig?.factors_json) {
    try {
      const o = JSON.parse(latestSig.factors_json) as Record<string, number>;
      factors = [
        o.ret ?? 0, o.liq_score ?? 0, o.pressure ?? 0, o.fomo ?? 0,
        o.dev ?? 0, o.log_vol ?? 0, o.vol_cluster ?? 0, o.momentum_rev ?? 0,
        o.rel_strength ?? 0, o.hl_range ?? 0, o.close_pos ?? 0, o.vol_trend ?? 0
      ];
    } catch {/* ignore */}
  }

  const eventsRes = await cf.env.DB.prepare(
    `SELECT time, event_type, score, prev_score
     FROM signal_events
     WHERE address = ?
     ORDER BY time DESC
     LIMIT 50`
  )
    .bind(address)
    .all<{ time: number; event_type: 'buy_trigger' | 'sell_trigger' | 'fomo_spike'; score: number; prev_score: number | null }>();

  return NextResponse.json({
    token: {
      address,
      symbol: tokenRow?.symbol ?? '',
      name: tokenRow?.name ?? '',
      image_url: tokenRow?.image_url ?? null,
      price_usd: tokenRow?.price_usd ?? null,
      price_change_h24: tokenRow?.price_change_h24 ?? null,
      liquidity_usd: tokenRow?.liquidity_usd ?? null,
      fdv: tokenRow?.fdv ?? null,
      pair_address: tokenRow?.pair_address ?? null
    },
    history: histRes.results ?? [],
    factors,
    events: eventsRes.results ?? []
  });
}
