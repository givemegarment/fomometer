/**
 * Swaps that paid the FOMOMETER referral fee, read from the chain.
 *
 * The Buy and Sell buttons on the site open Jupiter with our referral account; Jupiter
 * pays the fee into a token account owned by that referral account. So a transaction is
 * one of ours exactly when it raised the balance of such an account. The labeler walks
 * the signatures of those accounts, parses each transaction and stores the swap. Nothing
 * here trusts the browser: a swap counts only if the chain shows the fee.
 */

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
/** A buy counts as following a signal when the token had a BUY this long before it. */
export const SIGNAL_WINDOW_SEC = 3600;
/** Transactions fetched per run, so a backlog catches up over several runs within the subrequest limit. */
const MAX_TX_PER_RUN = 15;
const SIGNATURES_PER_ACCOUNT = 100;

type TokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
};

/** The parts of a `getTransaction` (jsonParsed) result this module reads. */
export type ParsedTx = {
  blockTime: number | null;
  transaction: {
    signatures: string[];
    message: { accountKeys: Array<{ pubkey: string; signer: boolean }> };
  };
  meta: {
    err: unknown;
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
};

export type Swap = {
  signature: string;
  blockTime: number;
  wallet: string;
  side: 'buy' | 'sell';
  mint: string;
  tokenAmount: string;
  feeMint: string;
  feeUi: number;
  notionalUi: number;
};

/** Balance changes per token account, as BigInt, keyed by account index. */
function deltas(meta: NonNullable<ParsedTx['meta']>) {
  const pre = new Map((meta.preTokenBalances ?? []).map((b) => [b.accountIndex, b]));
  const out: Array<{ mint: string; owner: string | undefined; decimals: number; delta: bigint }> = [];
  for (const post of meta.postTokenBalances ?? []) {
    const before = BigInt(pre.get(post.accountIndex)?.uiTokenAmount.amount ?? '0');
    const delta = BigInt(post.uiTokenAmount.amount) - before;
    if (delta !== 0n) out.push({ mint: post.mint, owner: post.owner, decimals: post.uiTokenAmount.decimals, delta });
  }
  // A token account closed in the transaction appears only in the pre balances.
  const postIdx = new Set((meta.postTokenBalances ?? []).map((b) => b.accountIndex));
  for (const b of meta.preTokenBalances ?? []) {
    if (postIdx.has(b.accountIndex)) continue;
    const delta = -BigInt(b.uiTokenAmount.amount);
    if (delta !== 0n) out.push({ mint: b.mint, owner: b.owner, decimals: b.uiTokenAmount.decimals, delta });
  }
  return out;
}

/**
 * The swap in a transaction, or null when it is not one of ours: failed, no fee paid to
 * an account owned by `referral`, or no token moved in or out of the signer's wallet.
 */
export function parseSwap(tx: ParsedTx, referral: string, feeBps: number): Swap | null {
  const meta = tx.meta;
  if (!meta || meta.err != null || tx.blockTime == null) return null;
  const wallet = tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey;
  const signature = tx.transaction.signatures[0];
  if (!wallet || !signature) return null;

  const changes = deltas(meta);
  const fee = changes.find((c) => c.owner === referral && c.delta > 0n);
  if (!fee) return null;

  // The traded token: the signer's largest balance change in anything but wrapped SOL.
  const traded = changes
    .filter((c) => c.owner === wallet && c.mint !== WSOL_MINT)
    .sort((a, b) => (abs(b.delta) > abs(a.delta) ? 1 : -1))[0];
  if (!traded) return null;

  const feeUi = Number(fee.delta) / 10 ** fee.decimals;
  return {
    signature,
    blockTime: tx.blockTime,
    wallet,
    side: traded.delta > 0n ? 'buy' : 'sell',
    mint: traded.mint,
    tokenAmount: abs(traded.delta).toString(),
    feeMint: fee.mint,
    feeUi,
    notionalUi: feeUi / (feeBps / 10_000)
  };
}

const abs = (x: bigint) => (x < 0n ? -x : x);

type Env = {
  DB: D1Database;
  SOLANA_RPC_URL: string;
  JUP_REFERRAL_ACCOUNT: string;
  JUP_REFERRAL_FEE_BPS: string;
  /** The referral account's fee token accounts, comma-separated (public RPCs refuse getTokenAccountsByOwner). */
  JUP_FEE_ACCOUNTS: string;
};

async function rpc<T>(env: Env, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(env.SOLANA_RPC_URL, {
    method: 'POST',
    // Public RPC endpoints answer 403 to requests without a user agent, which is what a Worker sends.
    headers: { 'content-type': 'application/json', 'user-agent': 'fomometer-labeler/1.0 (+https://fomometer.xyz)' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result as T;
}

/**
 * Reads new transactions of the referral account's fee token accounts and stores the swaps.
 * parseSwap still checks the owner, so a wrong entry in the list stores nothing.
 * Cursor per account in engine_state.swap_cursor: the newest signature already handled.
 * Returns how many swaps were stored.
 */
export async function scanSwaps(env: Env): Promise<{ stored: number; seen: number }> {
  const referral = env.JUP_REFERRAL_ACCOUNT;
  const feeBps = parseInt(env.JUP_REFERRAL_FEE_BPS, 10) || 100;
  const accounts = (env.JUP_FEE_ACCOUNTS ?? '').split(',').map((a) => a.trim()).filter(Boolean);
  if (!referral || !env.SOLANA_RPC_URL || !accounts.length) return { stored: 0, seen: 0 };

  const curRow = await env.DB.prepare(`SELECT value FROM engine_state WHERE key = 'swap_cursor'`).first<{ value: string }>();
  const cursor: Record<string, string> = curRow ? JSON.parse(curRow.value) : {};

  // One entry per signature (a transaction can touch several fee accounts), oldest first,
  // so the cursor never skips a signature.
  const pending = new Map<string, { accounts: string[]; slot: number; failed: boolean }>();
  for (const pubkey of accounts) {
    const sigs = await rpc<Array<{ signature: string; slot: number; err: unknown }>>(env, 'getSignaturesForAddress', [
      pubkey,
      { limit: SIGNATURES_PER_ACCOUNT, ...(cursor[pubkey] ? { until: cursor[pubkey] } : {}) }
    ]);
    if (sigs.length === SIGNATURES_PER_ACCOUNT) console.warn(`swaps: ${pubkey} has ${SIGNATURES_PER_ACCOUNT}+ new signatures; older ones may be skipped`);
    for (const s of sigs) {
      const p = pending.get(s.signature) ?? { accounts: [], slot: s.slot, failed: s.err != null };
      p.accounts.push(pubkey);
      pending.set(s.signature, p);
    }
  }
  const batch = [...pending.entries()].sort((a, b) => a[1].slot - b[1].slot).slice(0, MAX_TX_PER_RUN);

  const swaps: Swap[] = [];
  for (const [signature, p] of batch) {
    // A failed transaction moved no funds: skip it without fetching.
    if (!p.failed) {
      const tx = await rpc<ParsedTx | null>(env, 'getTransaction', [
        signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }
      ]);
      if (!tx) break; // not available yet: stop here so the cursor does not pass it
      const swap = parseSwap(tx, referral, feeBps);
      if (swap) swaps.push(swap);
    }
    for (const a of p.accounts) cursor[a] = signature;
  }

  const stmts = [];
  for (const s of swaps) {
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO swaps
           (signature, block_time, wallet, side, mint, token_amount, fee_mint, fee_ui, notional_ui, signal_event_id, signal_time)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, e.id, e.time
           FROM (SELECT 1) LEFT JOIN (
             SELECT id, time FROM signal_events
              WHERE address = ?5 AND event_type = 'buy_trigger' AND ?4 = 'buy' AND time BETWEEN ?2 - ?10 AND ?2
              ORDER BY time DESC LIMIT 1
           ) e`
      ).bind(s.signature, s.blockTime, s.wallet, s.side, s.mint, s.tokenAmount, s.feeMint, s.feeUi, s.notionalUi, SIGNAL_WINDOW_SEC)
    );
  }
  stmts.push(
    env.DB.prepare(
      `INSERT INTO engine_state (key, value, updated_at) VALUES ('swap_cursor', ?, unixepoch())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(JSON.stringify(cursor))
  );
  await env.DB.batch(stmts);
  return { stored: swaps.length, seen: batch.length };
}
