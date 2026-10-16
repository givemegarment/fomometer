import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { loadShadow, pruneShadow, shadowUpdates } from './shadow';

// Loaded at runtime: vitest 2.1 does not resolve the node:sqlite builtin itself.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const NOW = 1_800_000_000;
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

function grad(raw: InstanceType<typeof DatabaseSync>, mint: string, ageH: number, extra: { checked?: boolean; active?: boolean } = {}) {
  raw
    .prepare(`INSERT INTO pump_graduates (mint, sig, migrated_at, checked_at, active) VALUES (?, ?, ?, ?, ?)`)
    .run(mint, `sig-${mint}`, NOW - ageH * H, extra.checked ? NOW - H : null, extra.active ? 1 : 0);
}

describe('shadow plan', () => {
  it('screens graduates once they are 46 h old, only on screening runs', async () => {
    const { raw, DB } = d1();
    grad(raw, 'young', 10);
    grad(raw, 'due', 47);
    grad(raw, 'done', 50, { checked: true });
    expect((await loadShadow(DB, NOW, true)).due).toEqual(['due']);
    expect((await loadShadow(DB, NOW, false)).due).toEqual([]);
  });

  it('lists active graduates newest first, under 7 days old, and tokens with a recent shadow event', async () => {
    const { raw, DB } = d1();
    grad(raw, 'a60', 60, { checked: true, active: true });
    grad(raw, 'a50', 50, { checked: true, active: true });
    grad(raw, 'old', 24 * 8, { checked: true, active: true });
    raw.prepare(`INSERT INTO shadow_events (address, time, event_type, score) VALUES ('ev', ?, 'buy_trigger', 0.8)`).run(NOW - 3 * H);
    raw.prepare(`INSERT INTO shadow_events (address, time, event_type, score) VALUES ('stale', ?, 'buy_trigger', 0.8)`).run(NOW - 5 * H);
    const plan = await loadShadow(DB, NOW, false);
    expect([...plan.active]).toEqual([
      ['a50', NOW - 50 * H],
      ['a60', NOW - 60 * H]
    ]);
    expect(plan.postEvent).toEqual(['ev']);
  });
});

describe('shadowUpdates', () => {
  const plan = { due: ['rich', 'thin', 'gone', 'refused'], active: new Map([['drained', 0], ['kept', 0], ['missing', 0]]), postEvent: [] };
  const liq = new Map([
    ['rich', 40_000],
    ['thin', 9_000],
    ['drained', 12_000],
    ['kept', 30_000]
  ]);

  it('activates graduates at or above the filter, fails the rest, and waits on a refused batch', async () => {
    const { raw, DB } = d1();
    for (const m of [...plan.due, ...plan.active.keys()]) grad(raw, m, 47, { active: plan.active.has(m) });
    const { stmts, activated } = shadowUpdates(DB, NOW, plan, liq, 25_000, new Set(['rich', 'thin', 'gone']));
    await DB.batch(stmts);
    expect(activated).toEqual(['rich']);
    const rows = Object.fromEntries(
      (raw.prepare(`SELECT mint, checked_at, active FROM pump_graduates`).all() as Array<{ mint: string; checked_at: number | null; active: number }>).map(
        (r) => [r.mint, [r.checked_at, r.active]]
      )
    );
    expect(rows).toMatchObject({
      rich: [NOW, 1],
      thin: [NOW, 0],
      gone: [NOW, 0],
      refused: [null, 0],
      drained: [null, 0],
      kept: [null, 1],
      missing: [null, 1]
    });
  });
});

describe('pruneShadow', () => {
  it('ends tracking after 7 days and drops inactive graduates past that', async () => {
    const { raw, DB } = d1();
    grad(raw, 'old-active', 24 * 8, { checked: true, active: true });
    grad(raw, 'old-failed', 24 * 8, { checked: true });
    grad(raw, 'recent', 50, { checked: true });
    await DB.batch(pruneShadow(DB, NOW, NOW - 72 * H));
    expect(raw.prepare(`SELECT mint FROM pump_graduates ORDER BY mint`).all()).toEqual([{ mint: 'recent' }]);
  });
});
