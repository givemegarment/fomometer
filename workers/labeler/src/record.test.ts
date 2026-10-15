import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { DatabaseSync as DB } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordSignals } from './record';

// Loaded at runtime: vitest 2.1 does not resolve the node:sqlite builtin itself.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = DB;

// Test-only keypair from the seed 1..32 (same as chain.test.ts; public, never funded).
const KEY = JSON.stringify([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 121, 181, 86, 46,
  143, 230, 84, 249, 64, 120, 177, 18, 232, 169, 139, 167, 144, 31, 133, 58, 230, 149, 190, 215, 224, 227, 145, 11, 173, 4, 150, 100
]);
const MINT = 'DtcicPCKTKeAh7TDEzTym3hXeoHAoMiBdYJhMYxZpump';

/** The slice of D1 that record.ts uses, over node:sqlite with the real schema. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../infra/d1-schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    run: async () => db.prepare(sql).run(...(args as never[]))
  });
  return {
    raw: db,
    DB: { prepare: (sql: string) => stmt(sql), batch: async (s: Array<{ run: () => Promise<unknown> }>) => Promise.all(s.map((x) => x.run())) }
  };
}

let sendCount = 0;
let statuses: Record<string, { confirmationStatus: string; err: unknown } | null> = {};
let failSendAt = -1;

beforeEach(() => {
  sendCount = 0;
  statuses = {};
  failSendAt = -1;
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const { method, params } = JSON.parse(init.body);
    const ok = (result: unknown) => new Response(JSON.stringify({ result }));
    if (method === 'getLatestBlockhash') return ok({ value: { blockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k' } });
    if (method === 'sendTransaction') {
      if (sendCount++ === failSendAt) return new Response(JSON.stringify({ error: { message: 'rate limited' } }));
      return ok(`sig${sendCount}`);
    }
    if (method === 'getSignatureStatuses') return ok({ value: (params[0] as string[]).map((s) => statuses[s] ?? null) });
    throw new Error(`unexpected ${method}`);
  });
});
afterEach(() => vi.unstubAllGlobals());

const now = () => Math.floor(Date.now() / 1000);
function addEvent(db: DatabaseSync, id: number, ageSec: number, extra = '') {
  db.prepare(
    `INSERT INTO signal_events (id, address, time, event_type, score${extra ? ', chain_sig, chain_at' : ''}) VALUES (?, ?, ?, 'buy_trigger', 0.71${extra ? ', ?, ?' : ''})`
  ).run(...([id, MINT, now() - ageSec, ...(extra ? [extra, now() - ageSec] : [])] as never[]));
}
const row = (db: DatabaseSync, id: number) => db.prepare('SELECT chain_sig, chain_ok FROM signal_events WHERE id = ?').get(id) as { chain_sig: string | null; chain_ok: number | null };
const env = (DB: unknown, on = true) => ({ DB: DB as D1Database, CHAIN_RECORD_ENABLED: on ? 'true' : 'false', CHAIN_RECORD_KEY: KEY });

describe('recordSignals', () => {
  it('does nothing while switched off', async () => {
    const { raw, DB } = d1();
    addEvent(raw, 1, 30);
    expect(await recordSignals(env(DB, false), 'rpc')).toEqual({ posted: 0, landed: 0, lost: 0, error: null });
    expect(sendCount).toBe(0);
  });

  it('posts fresh events, eight to a transaction, and never old ones', async () => {
    const { raw, DB } = d1();
    for (let id = 1; id <= 10; id++) addEvent(raw, id, 60);
    addEvent(raw, 11, 20 * 60); // older than the post window
    const r = await recordSignals(env(DB), 'rpc');
    expect(r).toMatchObject({ posted: 10, error: null });
    expect(sendCount).toBe(2);
    expect(row(raw, 1).chain_sig).toBe('sig1');
    expect(row(raw, 10).chain_sig).toBe('sig2');
    expect(row(raw, 11).chain_sig).toBeNull();
  });

  it('marks landed transactions and handles expired ones by age', async () => {
    const { raw, DB } = d1();
    addEvent(raw, 1, 120, 'landed');
    statuses.landed = { confirmationStatus: 'confirmed', err: null };
    addEvent(raw, 2, 6 * 60, 'gone-fresh'); // sent 6 min ago, event still inside the window: post again
    addEvent(raw, 3, 12 * 60, 'gone-old'); // event past the window: stays off chain
    const r = await recordSignals(env(DB), 'rpc');
    expect(row(raw, 1)).toEqual({ chain_sig: 'landed', chain_ok: 1 });
    expect(row(raw, 2).chain_sig).toBe('sig1'); // reposted in the same run
    expect(row(raw, 3)).toEqual({ chain_sig: 'gone-old', chain_ok: 0 });
    expect(r).toMatchObject({ landed: 1, lost: 2, posted: 1 });
  });

  it('stores what was sent when a later transaction fails, so nothing is posted twice', async () => {
    const { raw, DB } = d1();
    for (let id = 1; id <= 10; id++) addEvent(raw, id, 60);
    failSendAt = 1;
    const r = await recordSignals(env(DB), 'rpc');
    expect(r).toMatchObject({ posted: 8, error: 'sendTransaction: rate limited' });
    expect(row(raw, 8).chain_sig).toBe('sig1');
    expect(row(raw, 9).chain_sig).toBeNull();
  });
});
