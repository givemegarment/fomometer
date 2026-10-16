import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graduateMint, MIGRATION_ACCOUNT, parseCursor, scanGraduates } from './pump';

// Loaded at runtime: vitest 2.1 does not resolve the node:sqlite builtin itself.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const WSOL = 'So11111111111111111111111111111111111111112';
// From MigrateV2 transaction 3UWZhM7L… (16 Oct 2026): the migrated mint and wrapped SOL.
const MINT = '9iiQcQu7evYyKNCrpcbjMumHXxZX2R8YnELSBi1apump';
const tx = (mints: string[], err: unknown = null) => ({ meta: { err, postTokenBalances: mints.map((mint) => ({ mint })) } });

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../infra/d1-schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...(args as never[])) ?? null,
    run: async () => db.prepare(sql).run(...(args as never[]))
  });
  const DB = { prepare: (sql: string) => stmt(sql), batch: async (s: Array<{ run: () => Promise<unknown> }>) => Promise.all(s.map((x) => x.run())) };
  return { raw: db, DB: DB as unknown as D1Database };
}

/** RPC stub: the signature page (newest first) and a transaction per signature. */
function stubRpc(page: Array<{ signature: string; blockTime: number; err?: unknown }>, txs: Record<string, unknown>) {
  const calls: Array<{ method: string; params: unknown[] }> = [];
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const { method, params } = JSON.parse(init.body) as { method: string; params: unknown[] };
    calls.push({ method, params });
    const result = method === 'getSignaturesForAddress' ? page.map((p) => ({ err: null, ...p })) : (txs[params[0] as string] ?? null);
    return new Response(JSON.stringify({ result }));
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('graduateMint', () => {
  it('takes the one mint that is not wrapped SOL', () => {
    expect(graduateMint(tx([MINT, WSOL, MINT]))).toBe(MINT);
  });
  it('ignores failed or ambiguous transactions', () => {
    expect(graduateMint(tx([MINT, WSOL], { InstructionError: [0, 'x'] }))).toBeNull();
    expect(graduateMint(tx([MINT, 'Other1111111111111111111111111111111111111', WSOL]))).toBeNull();
    expect(graduateMint(null)).toBeNull();
  });
});

describe('scanGraduates', () => {
  it('stores successful migrations, skips failed ones without a fetch, and moves the cursor', async () => {
    const { raw, DB } = d1();
    const calls = stubRpc(
      [
        { signature: 'S3', blockTime: 300 },
        { signature: 'S2', blockTime: 200, err: { InstructionError: [0, 'x'] } },
        { signature: 'S1', blockTime: 100 }
      ],
      { S1: tx(['MintA', WSOL]), S3: tx([MINT, WSOL]) }
    );
    expect(await scanGraduates({ DB }, 'https://rpc')).toEqual({ found: 2, seen: 3 });
    expect(calls[0]).toEqual({ method: 'getSignaturesForAddress', params: [MIGRATION_ACCOUNT, { limit: 100 }] });
    expect(calls.filter((c) => c.method === 'getTransaction').map((c) => c.params[0])).toEqual(['S1', 'S3']);
    expect(raw.prepare(`SELECT mint, sig, migrated_at, checked_at, active FROM pump_graduates ORDER BY migrated_at`).all()).toEqual([
      { mint: 'MintA', sig: 'S1', migrated_at: 100, checked_at: null, active: 0 },
      { mint: MINT, sig: 'S3', migrated_at: 300, checked_at: null, active: 0 }
    ]);

    const next = stubRpc([], {});
    await scanGraduates({ DB }, 'https://rpc');
    expect(next[0]!.params[1]).toEqual({ limit: 1000, until: 'S3' });
  });

  it('stops at a transaction the node does not return yet and retries it next run', async () => {
    const { raw, DB } = d1();
    stubRpc(
      [
        { signature: 'S2', blockTime: 200 },
        { signature: 'S1', blockTime: 100 }
      ],
      { S2: tx([MINT, WSOL]) }
    );
    expect(await scanGraduates({ DB }, 'https://rpc')).toEqual({ found: 0, seen: 2 });
    expect(raw.prepare(`SELECT value FROM engine_state WHERE key = 'pump_cursor'`).get()).toBeUndefined();
  });

  it('walks pages back to the cursor, handles the oldest first, and keeps what it found when the RPC fails', async () => {
    const { raw, DB } = d1();
    raw.prepare(`INSERT INTO engine_state (key, value, updated_at) VALUES ('pump_cursor', 'S0', 0)`).run();
    // 1,500 signatures newer than the cursor, S1500 newest: two pages of 1,000 and 500.
    const all = Array.from({ length: 1500 }, (_, i) => ({ signature: `S${1500 - i}`, blockTime: 1500 - i, err: null }));
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const { method, params } = JSON.parse(init.body) as { method: string; params: [string, Record<string, unknown>] };
      if (method === 'getSignaturesForAddress') {
        calls.push(params[1]);
        const from = params[1].before ? all.findIndex((x) => x.signature === params[1].before) + 1 : 0;
        return new Response(JSON.stringify({ result: all.slice(from, from + 1000) }));
      }
      // The third transaction is refused.
      if (params[0] === 'S3') return new Response('rate limited', { status: 429 });
      return new Response(JSON.stringify({ result: tx([`Mint${params[0]}`, WSOL]) }));
    });
    const r = await scanGraduates({ DB }, 'https://rpc');
    expect(calls).toEqual([
      { limit: 1000, until: 'S0' },
      { limit: 1000, until: 'S0', before: 'S501' }
    ]);
    expect(r).toEqual({ found: 2, seen: 1500, error: 'getTransaction: HTTP 429 rate limited' });
    expect(raw.prepare(`SELECT mint FROM pump_graduates ORDER BY migrated_at`).all()).toEqual([{ mint: 'MintS1' }, { mint: 'MintS2' }]);
    expect(raw.prepare(`SELECT value FROM engine_state WHERE key = 'pump_cursor'`).get()).toEqual({ value: JSON.stringify({ sig: 'S2', time: 2 }) });
  });

  it('walks back by time when the node does not know the cursor signature', async () => {
    const { raw, DB } = d1();
    raw.prepare(`INSERT INTO engine_state (key, value, updated_at) VALUES ('pump_cursor', ?, 0)`).run(JSON.stringify({ sig: 'OLD', time: 1000 }));
    // Newest first: two after the cursor time, one at it, one before.
    const all = [
      { signature: 'N2', blockTime: 1200, err: null },
      { signature: 'N1', blockTime: 1100, err: null },
      { signature: 'OLD', blockTime: 1000, err: null },
      { signature: 'P', blockTime: 900, err: null }
    ];
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const { method, params } = JSON.parse(init.body) as { method: string; params: [string, Record<string, unknown>] };
      if (method === 'getSignaturesForAddress') {
        calls.push(params[1]);
        if (params[1].until) return new Response(JSON.stringify({ error: { message: 'Transaction OLD not found' } }));
        return new Response(JSON.stringify({ result: all }));
      }
      return new Response(JSON.stringify({ result: tx([`Mint${params[0]}`, WSOL]) }));
    });
    expect(await scanGraduates({ DB }, 'https://rpc')).toEqual({ found: 2, seen: 2 });
    expect(calls).toEqual([{ limit: 1000, until: 'OLD' }, { limit: 1000 }]);
    expect(raw.prepare(`SELECT value FROM engine_state WHERE key = 'pump_cursor'`).get()).toEqual({ value: JSON.stringify({ sig: 'N2', time: 1200 }) });
  });

  it('reads a bare-signature cursor', () => {
    expect(parseCursor('abc')).toEqual({ sig: 'abc', time: null });
    expect(parseCursor(JSON.stringify({ sig: 'abc', time: 5 }))).toEqual({ sig: 'abc', time: 5 });
    expect(parseCursor(undefined)).toBeNull();
  });
});
