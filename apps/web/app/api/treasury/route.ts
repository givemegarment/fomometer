import { NextResponse } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';
import { getCF } from '@/lib/cf';
import { JUP_FEE_ACCOUNTS, JUP_REFERRAL_ACCOUNT, SOLANA_RPC_URL } from '@/lib/trade';

export const runtime = 'edge';

type Parsed = { mint: string; owner: string; tokenAmount: { uiAmount: number | null } };

/**
 * Treasury data for /treasury: live balances of the referral fee accounts, read from the
 * chain, and totals of the swaps the labeler recorded (no wallet addresses). Balances are
 * unclaimed fees; claiming moves them out, the recorded totals keep counting.
 */
export async function GET() {
  const cf = await getCF();
  const rpc = cf?.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${cf.env.HELIUS_API_KEY}` : SOLANA_RPC_URL;
  const [{ balances, rpc_error }, swaps] = await Promise.all([readBalances(rpc), readSwaps()]);
  return NextResponse.json(
    { referral_account: JUP_REFERRAL_ACCOUNT, balances, rpc_error, ...swaps },
    { headers: { 'cache-control': 'public, max-age=120' } }
  );
}

type Balances = { balances: Array<{ account: string; mint: string; amount: number }> | null; rpc_error: string | null };

/** `rpc_error` names the failure without the URL, which can contain the API key. */
async function readBalances(rpc: string): Promise<Balances> {
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'fomometer-web/1.0 (+https://fomometer.xyz)' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getMultipleAccounts', params: [JUP_FEE_ACCOUNTS, { encoding: 'jsonParsed' }] })
    });
    if (!res.ok) return { balances: null, rpc_error: `HTTP ${res.status}` };
    const body = (await res.json()) as { result?: { value: Array<{ data: { parsed?: { info?: Parsed } } } | null> }; error?: { message?: string } };
    if (!body.result) return { balances: null, rpc_error: body.error?.message?.slice(0, 120) ?? 'no result' };
    const balances = body.result.value.flatMap((v, i) => {
      const info = v?.data.parsed?.info;
      const account = JUP_FEE_ACCOUNTS[i];
      // Only accounts the referral account still owns; anything else is not ours to show.
      if (!info || !account || info.owner !== JUP_REFERRAL_ACCOUNT) return [];
      return [{ account, mint: info.mint, amount: info.tokenAmount.uiAmount ?? 0 }];
    });
    return { balances, rpc_error: null };
  } catch {
    return { balances: null, rpc_error: 'request failed' };
  }
}

type Totals = { fee_mint: string; swaps: number; buys: number; sells: number; from_signal: number; fees: number; volume: number };

const NO_SWAPS = { totals: [] as Totals[], totals_7d: [] as Totals[], recent: [] as unknown[], updated_at: null as number | null };

async function readSwaps() {
  const cf = await getCF();
  if (!cf?.env.DB) return NO_SWAPS;
  // Before the swaps migration is applied the table does not exist; show balances anyway.
  try {
    return await querySwaps(cf.env.DB);
  } catch {
    return NO_SWAPS;
  }
}

async function querySwaps(db: D1Database) {
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  const totalsSql = (since: boolean) => `
    SELECT fee_mint, COUNT(*) AS swaps, SUM(side = 'buy') AS buys, SUM(side = 'sell') AS sells,
           SUM(signal_event_id IS NOT NULL) AS from_signal, SUM(fee_ui) AS fees, SUM(notional_ui) AS volume
      FROM swaps ${since ? 'WHERE block_time >= ?' : ''}
     GROUP BY fee_mint`;
  const [all, week, recent, cursor] = await db.batch([
    db.prepare(totalsSql(false)),
    db.prepare(totalsSql(true)).bind(weekAgo),
    db.prepare(
      `SELECT s.signature, s.block_time, s.side, s.mint, COALESCE(t.symbol, '') AS symbol, s.fee_mint, s.fee_ui, s.notional_ui,
              s.signal_event_id IS NOT NULL AS from_signal
         FROM swaps s LEFT JOIN tokens t ON t.address = s.mint
        ORDER BY s.block_time DESC LIMIT 20`
    ),
    db.prepare(`SELECT updated_at FROM engine_state WHERE key = 'swap_cursor'`)
  ]);
  return {
    totals: (all?.results ?? []) as Totals[],
    totals_7d: (week?.results ?? []) as Totals[],
    recent: recent?.results ?? [],
    /** When the labeler last read the chain. */
    updated_at: (cursor?.results?.[0] as { updated_at?: number } | undefined)?.updated_at ?? null
  };
}
