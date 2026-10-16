import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graduateMint, MIGRATION_ACCOUNT, scanGraduates } from './pump';

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
    expect(next[0]!.params[1]).toEqual({ until: 'S3', limit: 1000 });
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
});
