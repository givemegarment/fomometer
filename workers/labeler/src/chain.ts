/**
 * On-chain record of signals: each event is written as a Memo on Solana in the same minute it
 * fires, so its block time proves it existed before the price moved and it cannot be added or
 * removed later. Anyone can rebuild the track record from the memos of CHAIN_RECORD_ADDRESS.
 *
 * Built by hand (no @solana/web3.js): a legacy transaction with Memo instructions, signed with
 * WebCrypto Ed25519. Memo text, one instruction per event:
 *   FMTR1 <BUY|SELL|BURST> <mint> s=<score 0-100> t=<unix time> id=<signal_events.id>
 */

export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
/** Memos per transaction; 8 memos of ≈ 90 bytes stay well under the 1,232-byte packet. */
export const MEMOS_PER_TX = 8;

export type ChainEvent = { id: number; address: string; time: number; event_type: string; score: number };

const TYPE_CODE: Record<string, string> = { buy_trigger: 'BUY', sell_trigger: 'SELL', fomo_spike: 'BURST' };

export function memoText(e: ChainEvent): string {
  return `FMTR1 ${TYPE_CODE[e.event_type] ?? e.event_type} ${e.address} s=${Math.round(e.score * 100)} t=${e.time} id=${e.id}`;
}

// --- base58 -----------------------------------------------------------------------------------

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function b58encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

export function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error('invalid base58');
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const c of s) {
    if (c !== '1') break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

// --- transaction ------------------------------------------------------------------------------

/** Solana's compact-u16 length prefix. */
function shortvec(n: number): number[] {
  const out: number[] = [];
  for (;;) {
    let b = n & 0x7f;
    n >>= 7;
    if (n === 0) {
      out.push(b);
      return out;
    }
    b |= 0x80;
    out.push(b);
  }
}

/**
 * Legacy message: payer (writable signer) and the Memo program (read-only), one Memo instruction
 * per text. Each instruction lists the payer, so the Memo program also checks that it signed.
 */
export function memoMessage(payer: Uint8Array, recentBlockhash: Uint8Array, texts: string[]): Uint8Array {
  const enc = new TextEncoder();
  const bytes: number[] = [1, 0, 1, ...shortvec(2), ...payer, ...b58decode(MEMO_PROGRAM_ID), ...recentBlockhash, ...shortvec(texts.length)];
  for (const t of texts) {
    const data = enc.encode(t);
    bytes.push(1, ...shortvec(1), 0, ...shortvec(data.length), ...data);
  }
  return Uint8Array.from(bytes);
}

export function serializeTx(signature: Uint8Array, message: Uint8Array): Uint8Array {
  return Uint8Array.from([...shortvec(1), ...signature, ...message]);
}

// --- keys -------------------------------------------------------------------------------------

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export type Signer = { publicKey: Uint8Array; sign: (msg: Uint8Array) => Promise<Uint8Array> };

/**
 * Signer from a Solana keypair secret: the 64-byte array (seed + public key) as JSON, the format
 * `solana-keygen` writes. Imported as a JWK; the secret never leaves WebCrypto after this.
 */
export async function signerFromSecret(secret: string): Promise<Signer> {
  const arr = Uint8Array.from(JSON.parse(secret) as number[]);
  if (arr.length !== 64) throw new Error('keypair must be 64 bytes');
  const seed = arr.slice(0, 32);
  const publicKey = arr.slice(32);
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'OKP', crv: 'Ed25519', d: b64url(seed), x: b64url(publicKey) },
    { name: 'Ed25519' },
    false,
    ['sign']
  );
  return { publicKey, sign: async (msg) => new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, msg)) };
}

// --- RPC --------------------------------------------------------------------------------------

/**
 * Helius free plan: historical methods (getSignaturesForAddress, getTransaction) answer HTTP 429 above a
 * few requests a second; the labeler's swaps alone sent 9 in a row (16 Oct 2026, every run refused).
 * All Helius calls of one invocation go through one queue, HELIUS_GAP_MS apart, and a 429 is retried
 * after HELIUS_RETRY_MS. Other RPC URLs (tests, the public fallback) are not paced.
 */
const HELIUS_GAP_MS = 600;
const HELIUS_RETRY_MS = [2000, 5000];
let heliusNext = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function heliusSlot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, heliusNext);
  heliusNext = at + HELIUS_GAP_MS;
  if (at > now) await sleep(at - now);
}

export async function solanaRpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const paced = url.includes('helius-rpc.com');
  for (let attempt = 0; ; attempt++) {
    if (paced) await heliusSlot();
    // Errors carry the method and status only, never the URL: it can contain an API key. Public RPC
    // endpoints answer 403 to requests without a user agent, which is what a Worker sends.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'fomometer-labeler/1.0 (+https://fomometer.xyz)' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    if (res.status === 429 && paced && attempt < HELIUS_RETRY_MS.length) {
      await sleep(HELIUS_RETRY_MS[attempt]!);
      continue;
    }
    if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: { message: string } };
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    return body.result as T;
  }
}

/**
 * Writes the events as memos, MEMOS_PER_TX per transaction, all on one recent blockhash.
 * Returns the transaction signature for each event id that was sent, and the error that stopped
 * the rest, if any: what was sent must be stored, or the next run would post it twice. Sent
 * without waiting for confirmation; the caller checks which ones landed.
 */
export async function recordEvents(
  rpcUrl: string,
  signer: Signer,
  events: ChainEvent[]
): Promise<{ sent: Map<number, string>; error: string | null }> {
  const sent = new Map<number, string>();
  if (!events.length) return { sent, error: null };
  const { value } = await solanaRpc<{ value: { blockhash: string } }>(rpcUrl, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const blockhash = b58decode(value.blockhash);
  for (let i = 0; i < events.length; i += MEMOS_PER_TX) {
    const chunk = events.slice(i, i + MEMOS_PER_TX);
    const message = memoMessage(signer.publicKey, blockhash, chunk.map(memoText));
    const signature = await signer.sign(message);
    const tx = serializeTx(signature, message);
    try {
      const sig = await solanaRpc<string>(rpcUrl, 'sendTransaction', [
        btoa(String.fromCharCode(...tx)),
        { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }
      ]);
      for (const e of chunk) sent.set(e.id, sig);
    } catch (err) {
      return { sent, error: (err as Error).message };
    }
  }
  return { sent, error: null };
}
