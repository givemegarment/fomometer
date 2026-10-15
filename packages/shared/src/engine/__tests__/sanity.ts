/**
 * Lightweight sanity check — runs `tsc --noEmit` only by default. Use Node:
 *   pnpm exec tsx packages/shared/src/engine/__tests__/sanity.ts
 *
 * Verifies that:
 *  - computeFactors returns 12 finite numbers on a tiny synthetic window.
 *  - StackVM executes ADD on two feature tokens and returns expected sum.
 *  - fallback score is bounded in [0, 1].
 */
import { computeFactors, StackVM, fallbackScore, computeScore } from '../index';
import type { Snapshot } from '../../types';

function mk(t: number, p: number): Snapshot {
  return {
    address: 'X',
    time: t,
    price_usd: p,
    price_native: null,
    market_cap: null,
    fdv: 1_000_000,
    liquidity_usd: 50_000,
    volume_m5: 100,
    volume_h1: 1000,
    volume_h6: 5000,
    volume_h24: 20000,
    price_change_m5: 1,
    price_change_h1: 5,
    price_change_h6: 15,
    price_change_h24: 25,
    buys_h1: 60,
    sells_h1: 40
  };
}

function approx(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

function run() {
  const window: Snapshot[] = [];
  for (let i = 0; i < 30; i++) {
    window.push(mk(i, 1 + i * 0.001));
  }
  const f = computeFactors(window);
  if (f.length !== 12) throw new Error('factor length != 12');
  for (const v of f) if (!Number.isFinite(v)) throw new Error('non-finite factor');

  // VM: ADD f0, f1 — token sequence [0, 1, 12]
  const vm = new StackVM({ featOffset: 12 });
  const out = vm.execute([0, 1, 12], f);
  if (out == null || !approx(out, (f[0] ?? 0) + (f[1] ?? 0))) {
    throw new Error(`VM ADD mismatch: got ${out}`);
  }

  // Fallback score in [0, 1]
  const s = fallbackScore(f);
  if (!(s >= 0 && s <= 1)) throw new Error('fallback out of bounds');

  // computeScore with fallback strategy
  const r = computeScore(f, { mode: 'fallback', formula: null });
  if (r.mode !== 'fallback') throw new Error('expected fallback mode');
  if (!(r.score >= 0 && r.score <= 1)) throw new Error('score oob');

  console.log('engine sanity: OK', { factors: f, score: r.score });
}

run();
