/**
 * pump.fun graduates, read from the chain: every successful MigrateV2 transaction of the pump.fun
 * migration account moves one token from its bonding curve to a PumpSwap pool. Stored in
 * pump_graduates for the engine's shadow tracking (workers/engine/src/shadow.ts).
 *
 * Cost: one getSignaturesForAddress per run plus one getTransaction per successful migration
 * (about 70 an hour on 16 Oct 2026); failed migration attempts, about half of the list, are skipped
 * without a fetch. Cursor in engine_state.pump_cursor: the newest signature already handled.
 */
import { solanaRpc } from './chain';

export const MIGRATION_ACCOUNT = '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg';
const WSOL = 'So11111111111111111111111111111111111111112';
/** First run: start from the newest page, no backfill. */
const FIRST_PAGE = 100;
const PAGE = 1000;
/** Bound on getTransaction calls per run; the rest waits for the next run (oldest first). */
const MAX_TX_PER_RUN = 60;

type SigInfo = { signature: string; blockTime: number | null; err: unknown };
type Tx = { meta: { err: unknown; postTokenBalances?: Array<{ mint: string }> } | null } | null;

/** The migrated token: the one mint in the transaction's balances that is not wrapped SOL. */
export function graduateMint(tx: Tx): string | null {
  if (!tx?.meta || tx.meta.err) return null;
  const mints = new Set((tx.meta.postTokenBalances ?? []).map((b) => b.mint).filter((m) => m !== WSOL));
  return mints.size === 1 ? [...mints][0]! : null;
}

export async function scanGraduates(env: { DB: D1Database }, rpcUrl: string): Promise<{ found: number; seen: number }> {
  const cur = await env.DB.prepare(`SELECT value FROM engine_state WHERE key = 'pump_cursor'`).first<{ value: string }>();
  const page = await solanaRpc<SigInfo[]>(rpcUrl, 'getSignaturesForAddress', [
    MIGRATION_ACCOUNT,
    cur ? { until: cur.value, limit: PAGE } : { limit: FIRST_PAGE }
  ]);
  if (!page.length) return { found: 0, seen: 0 };

  // Oldest first, so the cursor only ever moves past signatures that were handled.
  const todo = page.slice().reverse();
  let cursor: string | null = null;
  let fetched = 0;
  const stmts: D1PreparedStatement[] = [];
  for (const s of todo) {
    if (!s.err && s.blockTime) {
      if (fetched >= MAX_TX_PER_RUN) break;
      fetched++;
      const tx = await solanaRpc<Tx>(rpcUrl, 'getTransaction', [s.signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
      // Not visible yet on this node: stop here and retry it next run.
      if (!tx) break;
      const mint = graduateMint(tx);
      if (mint) {
        stmts.push(
          env.DB.prepare(`INSERT OR IGNORE INTO pump_graduates (mint, sig, migrated_at) VALUES (?, ?, ?)`).bind(mint, s.signature, s.blockTime)
        );
      }
    }
    cursor = s.signature;
  }
  if (cursor) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO engine_state (key, value, updated_at) VALUES ('pump_cursor', ?, unixepoch())
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind(cursor)
    );
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { found: stmts.length - (cursor ? 1 : 0), seen: page.length };
}
