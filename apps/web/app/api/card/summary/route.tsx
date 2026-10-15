import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getCF } from '@/lib/cf';
import { CHAIN_RECORD_ADDRESS, CHAIN_RECORD_ON } from '@/lib/chain';
import { C, CARD, Frame, cardFonts, fmtSignedPct, fmtUtc, toneOf } from '@/lib/cards';

export const runtime = 'edge';

/** Outcomes are complete 4 h 10 m after a signal; the window ends there. */
const SETTLE_SEC = 4 * 3600 + 600;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
const share = (xs: number[]) => (xs.length ? (xs.filter((x) => x > 0).length / xs.length) * 100 : null);

/**
 * GET /api/card/summary?days=1|7: the daily and weekly cards. BUY signals whose 4 h outcome is
 * known in the window, share higher and median after 4 h, the same for every tracked token
 * sampled in the window, the best and worst BUY, and (weekly) the swap fees earned.
 */
export async function GET(req: NextRequest) {
  const days = req.nextUrl.searchParams.get('days') === '7' ? 7 : 1;
  const cf = await getCF();
  if (!cf?.env.DB) return new Response(null, { status: 404 });
  const db = cf.env.DB;
  const end = Math.floor(Date.now() / 1000) - SETTLE_SEC;
  const start = end - days * 86400;

  const [buys, base, fees, fonts] = await Promise.all([
    db
      .prepare(
        `SELECT o.pnl_pct_4h AS pnl, COALESCE(t.symbol, '') AS symbol FROM signal_outcomes o
           LEFT JOIN tokens t ON t.address = o.address
          WHERE o.event_type = 'buy_trigger' AND o.event_time BETWEEN ? AND ? AND o.price_flag IS NULL`
      )
      .bind(start, end)
      .all<{ pnl: number | null; symbol: string }>(),
    db
      .prepare(
        `SELECT (price_4h / entry_price - 1) * 100 AS pnl FROM baseline_outcomes
          WHERE sample_time BETWEEN ? AND ? AND price_4h IS NOT NULL AND entry_price > 0`
      )
      .bind(start, end)
      .all<{ pnl: number }>(),
    days === 7
      ? db
          .prepare(
            `SELECT COUNT(*) AS n, COALESCE(SUM(fee_ui), 0) AS fee FROM swaps
              WHERE block_time >= ? AND fee_mint = 'So11111111111111111111111111111111111111112'`
          )
          .bind(Math.floor(Date.now() / 1000) - 7 * 86400)
          .first<{ n: number; fee: number }>()
      : Promise.resolve(null),
    cardFonts(req.nextUrl.origin)
  ]);
  const rows = buys.results ?? [];
  const priced = rows.filter((r): r is { pnl: number; symbol: string } => r.pnl != null);
  const pnl = priced.map((r) => r.pnl);
  const basePnl = (base.results ?? []).map((r) => r.pnl);
  const sorted = [...priced].sort((a, b) => b.pnl - a.pnl);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const buyMed = median(pnl);
  const baseMed = median(basePnl);

  const Big = ({ label, value, color, sub }: { label: string; value: string; color?: string; sub: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, background: '#1B1B1D', borderRadius: 24, padding: '26px 30px' }}>
      <div style={{ display: 'flex', fontSize: 22, color: C.dim }}>{label}</div>
      <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -2, color: color ?? C.text }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>{sub}</div>
    </div>
  );

  const Pick = ({ label, symbol, pnl }: { label: string; symbol: string; pnl: number }) => (
    <div style={{ display: 'flex', alignItems: 'baseline' }}>
      <div style={{ display: 'flex' }}>{label}</div>
      <div style={{ display: 'flex', marginLeft: 12, color: C.text, fontWeight: 700 }}>{`$${symbol}`}</div>
      <div style={{ display: 'flex', marginLeft: 12, color: toneOf(pnl) }}>{fmtSignedPct(pnl)}</div>
    </div>
  );

  return new ImageResponse(
    (
      <Frame
        right={`${days === 7 ? 'Week' : 'Day'} to ${fmtUtc(end)}`}
        footLeft={CHAIN_RECORD_ON ? `Every signal on Solana: ${CHAIN_RECORD_ADDRESS.slice(0, 4)}…${CHAIN_RECORD_ADDRESS.slice(-4)}` : 'Every signal priced 4 hours later'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 26 }}>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, letterSpacing: -1.5 }}>
            {days === 7 ? 'BUY signals, last 7 days' : 'BUY signals, last 24 hours'}
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <Big label="Signals priced" value={String(priced.length)} sub={rows.length > priced.length ? `${rows.length - priced.length} without a 4h price` : 'all with a 4h price'} />
            <Big
              label="Higher after 4h"
              value={share(pnl) == null ? '·' : `${Math.round(share(pnl)!)}%`}
              sub={share(basePnl) == null ? 'no comparison' : `any token: ${Math.round(share(basePnl)!)}%`}
            />
            <Big
              label="Median after 4h"
              value={fmtSignedPct(buyMed)}
              color={toneOf(buyMed)}
              sub={baseMed == null ? 'no comparison' : `any token: ${fmtSignedPct(baseMed)}`}
            />
          </div>
          <div style={{ display: 'flex', gap: 48, fontSize: 26, color: C.muted }}>
            {best && <Pick label="Best" symbol={best.symbol} pnl={best.pnl} />}
            {worst && worst !== best && <Pick label="Worst" symbol={worst.symbol} pnl={worst.pnl} />}
          </div>
          {fees && (
            <div style={{ display: 'flex', fontSize: 26, color: C.muted }}>
              {`Swap fees earned this week: ${Number(fees.fee.toPrecision(3))} SOL from ${fees.n} swaps`}
            </div>
          )}
        </div>
      </Frame>
    ),
    { ...CARD, fonts, headers: { 'Cache-Control': 'public, max-age=600' } }
  );
}
