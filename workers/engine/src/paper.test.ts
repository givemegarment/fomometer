import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@fomometer/shared';
import { EXITS, exitReturn, matchingRules, paperStatements } from './paper';

// Loaded at runtime: vitest 2.1 does not resolve the node:sqlite builtin itself.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const T0 = 1_800_000_000;
const H = 3600;

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../infra/d1-schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) })
  });
  const DB = { prepare: (sql: string) => stmt(sql), batch: async (s: Array<{ all: () => Promise<unknown> }>) => Promise.all(s.map((x) => x.all())) };
  return { raw: db, DB: DB as unknown as D1Database };
}

const snap = (address: string, price: number, extra: Partial<Snapshot> = {}): Snapshot =>
  ({
    address, time: T0, price_usd: price, price_native: null, market_cap: null, fdv: 1_000_000, liquidity_usd: 50_000,
    volume_m5: 500, volume_h1: 1_000, volume_h6: 0, volume_h24: 10_000, price_change_m5: 3, price_change_h1: 0, price_change_h6: 20,
    price_change_h24: 0, buys_h1: 0, sells_h1: 0, ...extra
  }) as Snapshot;

async function run(DB: D1Database, now: number, scored: Snapshot[], prices: Record<string, number>) {
  const r = await paperStatements(DB, now, scored, new Map(Object.entries(prices)));
  await DB.batch(r.stmts);
  return r;
}

describe('rules and exits', () => {
  it('opens only tradeable tokens; control always, the others by their ranges', () => {
    expect(matchingRules(snap('A', 1, { liquidity_usd: 24_999 }))).toEqual([]);
    expect(matchingRules(snap('A', 1))).toEqual(['control']);
    expect(matchingRules(snap('A', 1, { volume_m5: 50, price_change_m5: 0.5, volume_h24: 20_000 }))).toEqual([
      'control',
      'r1_quiet5m_flat',
      'r4_vol24_18_67k_flat5m'
    ]);
  });

  it('fills take-profit at its level, stops and trailing at the minute price', () => {
    const x = (id: string) => EXITS.find((e) => e.id === id)!;
    expect(exitReturn(x('tp30_sl10'), 1, 1.5, 1.5)).toBe(30);
    expect(exitReturn(x('tp30_sl10'), 1, 0.85, 1)).toBeCloseTo(-15);
    expect(exitReturn(x('tp30_sl10'), 1, 1.1, 1.2)).toBeNull();
    expect(exitReturn(x('trail15'), 1, 1.0, 1.2)).toBeCloseTo(0); // 1.2 → 1.0 is 16.7 % off the peak
    expect(exitReturn(x('trail15'), 1, 1.1, 1.2)).toBeNull();
  });
});

describe('paper trades', () => {
  it('opens once per rule and token, fires exits on the path, closes at 4 h with the rest as timeouts', async () => {
    const { raw, DB } = d1();
    expect((await run(DB, T0, [snap('A', 1)], { A: 1 })).opened).toBe(1);
    expect((await run(DB, T0 + 60, [snap('A', 1)], { A: 1 })).opened).toBe(0);
    await run(DB, T0 + H, [], { A: 1.25 }); // +25 %: tp20 fires; peak 1.25
    await run(DB, T0 + 2 * H, [], { A: 1.05 }); // 16 % off the peak: trail15 fires
    const r = await run(DB, T0 + 4 * H, [], { A: 0.95 });
    expect(r.closed).toBe(1);
    expect(raw.prepare(`SELECT exit_reason, ret_pct, peak_price FROM paper_trades`).get()).toEqual({
      exit_reason: 'hold',
      ret_pct: expect.closeTo(-8, 6),
      peak_price: 1.25
    });
    const exits = Object.fromEntries(
      (raw.prepare(`SELECT exit, ret_pct, reason FROM paper_exits`).all() as Array<{ exit: string; ret_pct: number; reason: string }>).map((e) => [
        e.exit,
        [Math.round(e.ret_pct * 100) / 100, e.reason]
      ])
    );
    expect(exits).toEqual({
      tp20_sl5: [17, 'fired'],
      trail15: [2, 'fired'],
      tp30_sl10: [-8, 'timeout'],
      tp50_sl20: [-8, 'timeout'],
      trail25: [-8, 'timeout']
    });
    // A new trade can open once the old one is closed.
    expect((await run(DB, T0 + 4 * H + 60, [snap('A', 1)], { A: 1 })).opened).toBe(1);
  });

  it('closes on the latest stored price when no price comes after the horizon', async () => {
    const { raw, DB } = d1();
    await run(DB, T0, [snap('A', 2)], { A: 2 });
    raw.prepare(`INSERT INTO token_snapshots (address, time, price_usd) VALUES ('A', ?, 1)`).run(T0 + 3 * H);
    expect((await run(DB, T0 + 4 * H, [], {})).closed).toBe(0); // waits
    expect((await run(DB, T0 + 4 * H + 15 * 60, [], {})).closed).toBe(1);
    expect(raw.prepare(`SELECT exit_reason, ret_pct FROM paper_trades`).get()).toEqual({ exit_reason: 'stale', ret_pct: -53 });
    expect(raw.prepare(`SELECT COUNT(*) n, MIN(ret_pct) lo, MAX(ret_pct) hi FROM paper_exits WHERE reason = 'stale'`).get()).toEqual({ n: 5, lo: -53, hi: -53 });
  });

  it('closes a pool switch at once and keeps it apart', async () => {
    const { raw, DB } = d1();
    await run(DB, T0, [snap('A', 1)], { A: 1 });
    await run(DB, T0 + 60, [], { A: 20 });
    expect(raw.prepare(`SELECT exit_reason FROM paper_trades`).get()).toEqual({ exit_reason: 'pool_switch' });
  });
});
