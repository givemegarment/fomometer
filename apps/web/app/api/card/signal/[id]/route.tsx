import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getCF } from '@/lib/cf';
import { C, CARD, Frame, Logo, Pill, Price, Spark, Stat, cardFonts, fmtMoney, fmtSignedPct, fmtUtc, logoDataUrl, shortSig } from '@/lib/cards';

export const runtime = 'edge';

/** Price window drawn on the card: the 90 minutes the score looked at. */
const WINDOW_SEC = 90 * 60;

const LABEL: Record<string, { text: string; color: string }> = {
  buy_trigger: { text: 'BUY', color: C.green },
  sell_trigger: { text: 'SELL', color: C.red },
  fomo_spike: { text: 'VOLUME BURST', color: C.amber }
};

/**
 * GET /api/card/signal/<event id>: the card posted to X when a signal fires. Token, signal type,
 * score against the threshold, price, liquidity, 24h change and the last 90 minutes of price,
 * all as they were at the signal; the Solana memo transaction once it has landed.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  const cf = await getCF();
  if (!cf?.env.DB || !Number.isFinite(id)) return new Response(null, { status: 404 });
  const db = cf.env.DB;

  const e = await db
    .prepare(
      `SELECT e.id, e.address, e.time, e.event_type, e.score, e.prev_score,
              json_extract(e.metadata_json, '$.threshold') AS threshold,
              CASE WHEN e.chain_ok = 1 THEN e.chain_sig END AS chain_sig,
              COALESCE(t.symbol, '') AS symbol, COALESCE(t.name, '') AS name, t.image_url
         FROM signal_events e LEFT JOIN tokens t ON t.address = e.address
        WHERE e.id = ?`
    )
    .bind(id)
    .first<{
      id: number;
      address: string;
      time: number;
      event_type: string;
      score: number;
      prev_score: number | null;
      threshold: number | null;
      chain_sig: string | null;
      symbol: string;
      name: string;
      image_url: string | null;
    }>();
  if (!e) return new Response(null, { status: 404 });

  const [snaps, logo, fonts] = await Promise.all([
    db
      .prepare(
        `SELECT time, price_usd, liquidity_usd, price_change_h24 FROM token_snapshots
          WHERE address = ? AND time > ? AND time <= ? ORDER BY time ASC`
      )
      .bind(e.address, e.time - WINDOW_SEC, e.time)
      .all<{ time: number; price_usd: number | null; liquidity_usd: number | null; price_change_h24: number | null }>(),
    logoDataUrl(e.image_url),
    cardFonts(req.nextUrl.origin)
  ]);
  const rows = (snaps.results ?? []).filter((r) => r.price_usd != null);
  const at = rows[rows.length - 1];
  const prices = rows.map((r) => r.price_usd!);
  const label = LABEL[e.event_type] ?? { text: e.event_type, color: C.muted };
  const score = Math.round(e.score * 100);
  // Burst thresholds are on the raw factor, not the score scale: no threshold mark for them.
  const th = e.event_type === 'fomo_spike' || e.threshold == null ? null : Math.round(e.threshold * 100);
  const move = prices.length > 1 ? (prices[prices.length - 1]! / prices[0]! - 1) * 100 : null;

  return new ImageResponse(
    (
      <Frame
        right={`Signal #${e.id} · ${fmtUtc(e.time)}`}
        footLeft={e.chain_sig ? `Recorded on Solana · tx ${shortSig(e.chain_sig)}` : 'Priced again 15 minutes, 1 hour and 4 hours later'}
      >
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <Logo src={logo} symbol={e.symbol} size={104} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, letterSpacing: -1.5 }}>${e.symbol || e.address.slice(0, 6)}</div>
                <div style={{ display: 'flex', fontSize: 26, color: C.muted }}>{e.name.slice(0, 28)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Pill label={label.text} color={label.color} />
              <div style={{ display: 'flex', fontSize: 26, color: C.muted }}>
                Score {e.prev_score != null && e.event_type !== 'fomo_spike' ? `${Math.round(e.prev_score * 100)} → ` : ''}
                <span style={{ color: C.text, fontWeight: 700, marginLeft: 8 }}>{score}</span>
                {th != null && <span style={{ marginLeft: 12 }}>{`(threshold ${th})`}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 44 }}>
              <Stat label="Price">
                <Price value={at?.price_usd ?? null} size={32} />
              </Stat>
              <Stat label="Liquidity">{fmtMoney(at?.liquidity_usd)}</Stat>
              <Stat label="24h">
                <span style={{ color: (at?.price_change_h24 ?? 0) >= 0 ? C.green : C.red }}>{fmtSignedPct(at?.price_change_h24)}</span>
              </Stat>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: C.dim }}>
              <span>Price, 90 minutes before the signal</span>
              <span style={{ color: move == null ? C.dim : move >= 0 ? C.green : C.red }}>{fmtSignedPct(move)}</span>
            </div>
            <div style={{ display: 'flex', background: C.panel, borderRadius: 24, padding: 20 }}>
              <Spark points={prices} width={484} height={280} color={move != null && move < 0 ? C.red : C.green} />
            </div>
          </div>
        </div>
      </Frame>
    ),
    { ...CARD, fonts, headers: { 'Cache-Control': 'public, max-age=300' } }
  );
}
