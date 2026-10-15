import { NextResponse } from 'next/server';
import { getCF } from '@/lib/cf';

export const runtime = 'edge';

const HORIZONS = ['15m', '1h', '4h'] as const;
type Horizon = (typeof HORIZONS)[number];
type EventType = 'buy_trigger' | 'sell_trigger' | 'fomo_spike';

type OutcomeRow = {
  event_type: EventType;
  pnl_pct_15m: number | null;
  pnl_pct_1h: number | null;
  pnl_pct_4h: number | null;
};

/**
 * Current engine settings (from engine_state.last_run) and the track record of
 * past signals (from signal_outcomes, filled by the labeler).
 *
 * "Favorable" is direction-aware: price up after BUY / volume burst, price down after SELL.
 * Medians, not means: a few 10x memecoin moves would dominate an average.
 */
export async function GET(req: Request) {
  const cf = await getCF();
  if (!cf?.env.DB) return NextResponse.json({ settings: null, days: 7, record: [] });

  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') ?? '7', 10) || 7));
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  const lastRunRow = await cf.env.DB.prepare(`SELECT value FROM engine_state WHERE key = 'last_run'`).first<{
    value: string;
  }>();
  let settings: Record<string, unknown> | null = null;
  if (lastRunRow?.value) {
    try {
      const v = JSON.parse(lastRunRow.value) as Record<string, unknown>;
      settings = {
        at: v.at ?? null,
        weights_trained: v.weights_trained ?? false,
        thresholds_trained: v.thresholds_trained ?? false,
        thresholds_adaptive: v.thresholds_adaptive ?? false,
        buy_th: v.buy_th ?? null,
        sell_th: v.sell_th ?? null,
        fomo_th: v.fomo_th ?? null,
        regime: v.regime ?? null,
        normalize_cross_sectional: v.normalize_cross_sectional ?? false,
        regime_aware: v.regime_aware ?? false,
        weights: pickWeights(v.weights)
      };
    } catch {
      /* malformed state: show no settings */
    }
  }

  const res = await cf.env.DB.prepare(
    `SELECT event_type, pnl_pct_15m, pnl_pct_1h, pnl_pct_4h
     FROM signal_outcomes WHERE event_time >= ? LIMIT 20000`
  )
    .bind(since)
    .all<OutcomeRow>();

  const byType = new Map<EventType, OutcomeRow[]>();
  for (const r of res.results ?? []) {
    const list = byType.get(r.event_type) ?? [];
    list.push(r);
    byType.set(r.event_type, list);
  }

  const record = (['buy_trigger', 'sell_trigger', 'fomo_spike'] as const).map((type) => {
    const rows = byType.get(type) ?? [];
    const horizons = {} as Record<Horizon, { n: number; favorable: number | null; median_pct: number | null }>;
    for (const h of HORIZONS) {
      const key = `pnl_pct_${h}` as const;
      const values = rows.map((r) => r[key]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
      const fav = values.filter((x) => (type === 'sell_trigger' ? x < 0 : x > 0)).length;
      horizons[h] = {
        n: values.length,
        favorable: values.length ? fav / values.length : null,
        median_pct: median(values)
      };
    }
    return { event_type: type, n: rows.length, horizons };
  });

  return NextResponse.json({ settings, days, record });
}

/** Base score weights as reported by the engine; anything that is not a finite number is dropped. */
function pickWeights(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
