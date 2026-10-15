/**
 * Writes fresh signal events to Solana as memos (./chain.ts) and checks that they landed.
 * Runs every minute. Only events at most POST_WINDOW_SEC old are posted: a memo written after
 * the price had time to move would prove nothing, so a missed event stays off chain for good.
 * Event ids are sequential, so a gap in the on-chain ids shows every event that was not posted.
 *
 * signal_events.chain_sig: the transaction; chain_ok: NULL pending, 1 landed, 0 did not land.
 */

import { recordEvents, signerFromSecret, solanaRpc, type ChainEvent } from './chain';

/** Post events up to this old; well before the first price check at 15 minutes. */
const POST_WINDOW_SEC = 10 * 60;
/** A transaction not seen this long after sending has expired (blockhashes live ≈ 90 s). */
const LAND_TIMEOUT_SEC = 5 * 60;
const MAX_EVENTS_PER_RUN = 40;

type Env = {
  DB: D1Database;
  /** 'true' to post. Off until the record wallet is funded and the owner starts it. */
  CHAIN_RECORD_ENABLED?: string;
  /** Secret: the record wallet's keypair, 64-byte JSON array. */
  CHAIN_RECORD_KEY?: string;
};

type StatusResult = { value: Array<{ confirmationStatus: string | null; err: unknown } | null> };

export async function recordSignals(
  env: Env,
  rpcUrl: string
): Promise<{ posted: number; landed: number; lost: number; error: string | null }> {
  if (env.CHAIN_RECORD_ENABLED !== 'true' || !env.CHAIN_RECORD_KEY) return { posted: 0, landed: 0, lost: 0, error: null };
  const now = Math.floor(Date.now() / 1000);

  // 1. Check what earlier runs sent. Bounded by time: nothing pending can be older than the
  //    post window plus the landing timeout.
  const pending = await env.DB.prepare(
    `SELECT id, time, chain_sig, chain_at FROM signal_events
      WHERE time >= ? AND chain_sig IS NOT NULL AND chain_ok IS NULL`
  )
    .bind(now - POST_WINDOW_SEC - LAND_TIMEOUT_SEC - 600)
    .all<{ id: number; time: number; chain_sig: string; chain_at: number }>();
  const rows = pending.results ?? [];
  const sigs = [...new Set(rows.map((r) => r.chain_sig))];
  const status = new Map<string, { confirmationStatus: string | null; err: unknown } | null>();
  if (sigs.length) {
    const res = await solanaRpc<StatusResult>(rpcUrl, 'getSignatureStatuses', [sigs, { searchTransactionHistory: true }]);
    sigs.forEach((s, i) => status.set(s, res.value[i] ?? null));
  }
  const stmts: D1PreparedStatement[] = [];
  let landed = 0;
  let lost = 0;
  for (const r of rows) {
    const st = status.get(r.chain_sig);
    if (st && st.err == null && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) {
      stmts.push(env.DB.prepare(`UPDATE signal_events SET chain_ok = 1 WHERE id = ?`).bind(r.id));
      landed++;
    } else if ((st && st.err != null) || now - r.chain_at > LAND_TIMEOUT_SEC) {
      // Failed or expired: post again while the event is still fresh, otherwise it stays off chain.
      stmts.push(
        r.time >= now - POST_WINDOW_SEC
          ? env.DB.prepare(`UPDATE signal_events SET chain_sig = NULL, chain_at = NULL WHERE id = ?`).bind(r.id)
          : env.DB.prepare(`UPDATE signal_events SET chain_ok = 0 WHERE id = ?`).bind(r.id)
      );
      lost++;
    }
  }
  if (stmts.length) await env.DB.batch(stmts);

  // 2. Post fresh events that have no transaction yet, oldest first.
  const fresh = await env.DB.prepare(
    `SELECT id, address, time, event_type, score FROM signal_events
      WHERE time >= ? AND chain_sig IS NULL AND chain_ok IS NULL
      ORDER BY id LIMIT ?`
  )
    .bind(now - POST_WINDOW_SEC, MAX_EVENTS_PER_RUN)
    .all<ChainEvent>();
  const events = fresh.results ?? [];
  if (!events.length) return { posted: 0, landed, lost, error: null };
  const signer = await signerFromSecret(env.CHAIN_RECORD_KEY);
  const { sent, error } = await recordEvents(rpcUrl, signer, events);
  const writes = [...sent].map(([id, sig]) =>
    env.DB.prepare(`UPDATE signal_events SET chain_sig = ?, chain_at = ? WHERE id = ?`).bind(sig, now, id)
  );
  if (writes.length) await env.DB.batch(writes);
  return { posted: sent.size, landed, lost, error };
}
