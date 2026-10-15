import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getCF } from '@/lib/cf';
import { C, CARD, Frame, Logo, Pill, Price, Spark, Stat, cardFonts, fmtSignedPct, fmtUtc, logoDataUrl, shortSig, toneOf } from '@/lib/cards';

export const runtime = 'edge';

const H4 = 4 * 3600;
/** Baseline samples this close to the signal count as "the same window". */
const BASELINE_SLACK_SEC = 30 * 60;

const LABEL: Record<string, { text: string; color: string }> = {
  buy_trigger: { text: 'BUY', color: C.green },
  sell_trigger: { text: 'SELL', color: C.red },
  fomo_spike: { text: 'VOLUME BURST', color: C.amber }
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * GET /api/card/outcome/<event id>: the follow-up card, posted as a reply 4 hours after the
 * signal. Return at 15 m, 1 h and 4 h, best and worst move inside the window, the price path
 * against the entry, and the median 4 h move of every tracked token sampled in the same window.
 * Losses look exactly like wins.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  const cf = await getCF();
  if (!cf?.env.DB || !Number.isFinite(id)) return new Response(null, { status: 404 });
  const db = cf.env.DB;

  const o = await db
    .prepare(
      `SELECT o.event_id, o.address, o.event_time, o.event_type, o.entry_price,
              o.pnl_pct_15m, o.pnl_pct_1h, o.pnl_pct_4h, o.max_pnl_pct_4h, o.min_pnl_pct_4h, o.price_flag, o.chain_sig,
              COALESCE(t.symbol, '') AS symbol, COALESCE(t.name, '') AS name, t.image_url
         FROM signal_outcomes o LEFT JOIN tokens t ON t.address = o.address
        WHERE o.event_id = ?`
    )
    .bind(id)
    .first<{
      event_id: number;
      address: string;
      event_time: number;
      event_type: string;
      entry_price: number;
      pnl_pct_15m: number | null;
      pnl_pct_1h: number | null;
      pnl_pct_4h: number | null;
      max_pnl_pct_4h: number | null;
      min_pnl_pct_4h: number | null;
      price_flag: string | null;
      chain_sig: string | null;
      symbol: string;
      name: string;
      image_url: string | null;
    }>();
  if (!o) return new Response(null, { status: 404 });

  const [snaps, base, logo, fonts] = await Promise.all([
    db
      .prepare(`SELECT price_usd FROM token_snapshots WHERE address = ? AND time >= ? AND time <= ? ORDER BY time ASC`)
      .bind(o.address, o.event_time, o.event_time + H4)
      .all<{ price_usd: number | null }>(),
    db
      .prepare(
        `SELECT (price_4h / entry_price - 1) * 100 AS pnl FROM baseline_outcomes
          WHERE sample_time BETWEEN ? AND ? AND price_4h IS NOT NULL AND entry_price > 0`
      )
      .bind(o.event_time - BASELINE_SLACK_SEC, o.event_time + BASELINE_SLACK_SEC)
      .all<{ pnl: number }>(),
    logoDataUrl(o.image_url),
    cardFonts(req.nextUrl.origin)
  ]);
  const prices = (snaps.results ?? []).map((r) => r.price_usd).filter((p): p is number => p != null);
  const baseMedian = median((base.results ?? []).map((r) => r.pnl));
  const label = LABEL[o.event_type] ?? { text: o.event_type, color: C.muted };
  const result = o.pnl_pct_4h;
  const exit = result == null ? null : o.entry_price * (1 + result / 100);

  return new ImageResponse(
    (
      <Frame
        right={`Signal #${o.event_id} · 4 hours later`}
        footLeft={o.chain_sig ? `Signal recorded on Solana · tx ${shortSig(o.chain_sig)}` : 'Every signal is priced the same way, wins and losses'}
      >
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26, width: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Logo src={logo} symbol={o.symbol} size={72} />
              <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, letterSpacing: -1 }}>${o.symbol || o.address.slice(0, 6)}</div>
              <Pill label={label.text} color={label.color} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 24, color: C.muted }}>{`After 4 hours (signal at ${fmtUtc(o.event_time)})`}</div>
              <div style={{ display: 'flex', fontSize: 120, fontWeight: 700, letterSpacing: -4, color: toneOf(result) }}>
                {result == null ? 'No price' : fmtSignedPct(result)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, color: C.muted }}>
                <Price value={o.entry_price} size={26} />
                <span>→</span>
                <Price value={exit} size={26} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 36 }}>
              <Stat label="15 min">
                <span style={{ color: toneOf(o.pnl_pct_15m) }}>{fmtSignedPct(o.pnl_pct_15m)}</span>
              </Stat>
              <Stat label="1 hour">
                <span style={{ color: toneOf(o.pnl_pct_1h) }}>{fmtSignedPct(o.pnl_pct_1h)}</span>
              </Stat>
              <Stat label="Best / worst">
                <span style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: C.green }}>{fmtSignedPct(o.max_pnl_pct_4h, 0)}</span>
                  <span style={{ color: C.dim }}>/</span>
                  <span style={{ color: C.red }}>{fmtSignedPct(o.min_pnl_pct_4h, 0)}</span>
                </span>
              </Stat>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 22, color: C.dim }}>Price over the 4 hours, dashed line at entry</div>
            <div style={{ display: 'flex', background: C.panel, borderRadius: 24, padding: 20 }}>
              <Spark points={prices} width={484} height={250} color={toneOf(result)} level={o.entry_price} markFirst />
            </div>
            <div style={{ display: 'flex', fontSize: 24, color: C.muted }}>
              {baseMedian == null
                ? 'No comparison sample for this window'
                : `Any token, same window: median ${fmtSignedPct(baseMedian)}`}
            </div>
          </div>
        </div>
      </Frame>
    ),
    { ...CARD, fonts, headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
