/**
 * pump.fun graduates, read from the chain: every successful MigrateV2 transaction of the pump.fun
 * migration account moves one token from its bonding curve to a PumpSwap pool. Stored in
 * pump_graduates for the engine's shadow tracking (workers/engine/src/shadow.ts).
 *
 * Cost: one getSignaturesForAddress per run plus one getTransaction per successful migration
 * (about 70 an hour on 16 Oct 2026); failed migration attempts, about half of the list, are skipped
 * without a fetch. Cursor in engine_state.pump_cursor: the newest signature already handled.
 * After a gap (or a cursor set back for a backfill) the pages are walked back to the cursor and
 * handled oldest first, MAX_TX_PER_RUN at a time, so the labeler catches up over several runs.
 * The cursor is JSON {sig, time}: Helius's free plan answers `until` with an older signature by
 * "Transaction … not found" (16 Oct 2026), and then the walk stops at the cursor's block time instead.
 */
import { solanaRpc } from './chain';

export const MIGRATION_ACCOUNT = '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg';
const WSOL = 'So11111111111111111111111111111111111111112';
/** First run: start from the newest page, no backfill. */
const FIRST_PAGE = 100;
const PAGE = 1000;
/** Pages walked back to the cursor: 12,000 signatures, about 80 hours of migrations. */
const MAX_PAGES = 12;
/** Bound on getTransaction calls per run (paced 600 ms apart in ./chain.ts); the rest waits for the next run. */
const MAX_TX_PER_RUN = 40;

type Cursor = { sig: string; time: number | null };

/** The stored cursor: JSON {sig, time}, or a bare signature (no time). */
export function parseCursor(v: string | undefined): Cursor | null {
  if (!v) return null;
  try {
    const c = JSON.parse(v) as Cursor;
    if (typeof c.sig === 'string') return { sig: c.sig, time: typeof c.time === 'number' ? c.time : null };
  } catch {
    /* a bare signature */
  }
  return { sig: v, time: null };
}

type SigInfo = { signature: string; blockTime: number | null; err: unknown };
type Tx = { meta: { err: unknown; postTokenBalances?: Array<{ mint: string }> } | null } | null;

/** The migrated token: the one mint in the transaction's balances that is not wrapped SOL. */
export function graduateMint(tx: Tx): string | null {
  if (!tx?.meta || tx.meta.err) return null;
  const mints = new Set((tx.meta.postTokenBalances ?? []).map((b) => b.mint).filter((m) => m !== WSOL));
  return mints.size === 1 ? [...mints][0]! : null;
}

export async function scanGraduates(
  env: { DB: D1Database },
  rpcUrl: string
): Promise<{ found: number; seen: number; error?: string }> {
  const row = await env.DB.prepare(`SELECT value FROM engine_state WHERE key = 'pump_cursor'`).first<{ value: string }>();
  const cur = parseCursor(row?.value);
  const page: SigInfo[] = [];
  /** Pages back from the newest; with `until` the node stops at the cursor, by time otherwise. */
  const walk = async (until: string | null, since: number | null) => {
    let before: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const p = await solanaRpc<SigInfo[]>(rpcUrl, 'getSignaturesForAddress', [
        MIGRATION_ACCOUNT,
        { limit: PAGE, ...(until ? { until } : {}), ...(before ? { before } : {}) }
      ]);
      const keep = since == null ? p : p.filter((s) => s.blockTime != null && s.blockTime > since);
      page.push(...keep);
      if (p.length < PAGE || keep.length < p.length) break;
      before = p[p.length - 1]!.signature;
    }
  };
  if (!cur) {
    page.push(...(await solanaRpc<SigInfo[]>(rpcUrl, 'getSignaturesForAddress', [MIGRATION_ACCOUNT, { limit: FIRST_PAGE }])));
  } else {
    try {
      await walk(cur.sig, null);
    } catch (err) {
      if (cur.time == null || !/not found/i.test((err as Error).message)) throw err;
      page.length = 0;
      await walk(null, cur.time);
    }
  }
  if (!page.length) return { found: 0, seen: 0 };

  // Oldest first, so the cursor only ever moves past signatures that were handled.
  const todo = page.slice().reverse();
  let cursor: Cursor | null = null;
  let fetched = 0;
  let error: string | undefined;
  const stmts: D1PreparedStatement[] = [];
  for (const s of todo) {
    if (!s.err && s.blockTime) {
      if (fetched >= MAX_TX_PER_RUN) break;
      fetched++;
      let tx: Tx;
      try {
        // Version 1: Solana transactions of version 1 appear since Oct 2026; with 0 the node refuses them.
        tx = await solanaRpc<Tx>(rpcUrl, 'getTransaction', [s.signature, { maxSupportedTransactionVersion: 1, commitment: 'confirmed' }]);
      } catch (err) {
        // Rate limit or a failed call: keep what this run found, retry from here next run.
        error = (err as Error).message;
        break;
      }
      // Not visible yet on this node: stop here and retry it next run.
      if (!tx) break;
      const mint = graduateMint(tx);
      if (mint) {
        stmts.push(
          env.DB.prepare(`INSERT OR IGNORE INTO pump_graduates (mint, sig, migrated_at) VALUES (?, ?, ?)`).bind(mint, s.signature, s.blockTime)
        );
      }
    }
    cursor = { sig: s.signature, time: s.blockTime };
  }
  if (cursor) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO engine_state (key, value, updated_at) VALUES ('pump_cursor', ?, unixepoch())
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind(JSON.stringify(cursor))
    );
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { found: stmts.length - (cursor ? 1 : 0), seen: page.length, ...(error ? { error } : {}) };
}
