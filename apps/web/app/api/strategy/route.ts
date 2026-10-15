import { NextResponse } from 'next/server';
import { getCF } from '@/lib/cf';

export const runtime = 'edge';

/**
 * Current engine settings (engine_state.last_run) and the track record summary
 * (engine_state.track_record, written hourly by the labeler: events by type,
 * the all-tokens baseline, flagged and lost counts). One query, two rows.
 */
export async function GET() {
  const cf = await getCF();
  if (!cf?.env.DB) return NextResponse.json({ settings: null, record: null });

  const rows = await cf.env.DB.prepare(
    `SELECT key, value FROM engine_state WHERE key IN ('last_run', 'track_record')`
  ).all<{ key: string; value: string }>();
  const byKey = new Map((rows.results ?? []).map((r) => [r.key, r.value]));
  const lastRun = byKey.get('last_run');

  let settings: Record<string, unknown> | null = null;
  if (lastRun) {
    try {
      const v = JSON.parse(lastRun) as Record<string, unknown>;
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
        weights: pickWeights(v.weights),
        // Events need at least this much liquidity (engine quality filter); the board dims tokens below it.
        min_liquidity_usd: finite((v.quality_filter as Record<string, unknown> | undefined)?.minLiquidityUsd)
      };
    } catch {
      /* malformed state: show no settings */
    }
  }

  let record: unknown = null;
  try {
    record = JSON.parse(byKey.get('track_record') ?? 'null');
  } catch {
    /* malformed: no record */
  }

  return NextResponse.json({ settings, record });
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

function finite(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}
