import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { b58decode, b58encode, memoMessage, memoText, MEMOS_PER_TX, serializeTx, signerFromSecret } from './chain';

// Test-only keypair from the seed 1..32 (public, never funded).
const SECRET = JSON.stringify([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 121, 181, 86, 46,
  143, 230, 84, 249, 64, 120, 177, 18, 232, 169, 139, 167, 144, 31, 133, 58, 230, 149, 190, 215, 224, 227, 145, 11, 173, 4, 150, 100
]);
const BLOCKHASH = 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k';
const MINT = 'DtcicPCKTKeAh7TDEzTym3hXeoHAoMiBdYJhMYxZpump';

describe('chain record', () => {
  it('writes the memo text the docs describe', () => {
    expect(memoText({ id: 47054, address: MINT, time: 1792091234, event_type: 'buy_trigger', score: 0.7123 })).toBe(
      `FMTR1 BUY ${MINT} s=71 t=1792091234 id=47054`
    );
    expect(memoText({ id: 1, address: MINT, time: 1, event_type: 'fomo_spike', score: 0.78 })).toMatch(/^FMTR1 BURST /);
  });

  it('round-trips base58, leading zeros included', () => {
    expect(b58encode(b58decode(BLOCKHASH))).toBe(BLOCKHASH);
    expect(b58encode(Uint8Array.from([0, 0, 1]))).toBe('112');
    expect(b58decode('112')).toEqual(Uint8Array.from([0, 0, 1]));
  });

  it('builds the same signed transaction as @solana/web3.js 1.95.8', async () => {
    // Golden value: the same two memos built and signed with web3.js Transaction (2026-10-15).
    const signer = await signerFromSecret(SECRET);
    expect(b58encode(signer.publicKey)).toBe('9C6hybhQ6Aycep9jaUnP6uL9ZYvDjUp1aSkFWPUFJtpj');
    const texts = [`FMTR1 BUY ${MINT} s=71 t=1792091234 id=47054`, `FMTR1 BURST ${MINT} s=78 t=1792091234 id=47055`];
    const message = memoMessage(signer.publicKey, b58decode(BLOCKHASH), texts);
    const tx = serializeTx(await signer.sign(message), message);
    expect(tx.length).toBe(338);
    expect(createHash('sha256').update(tx).digest('hex')).toBe('0fe8aaf4ab90712a027ba366a584d986612e76f74ecac99f2fb1622963102dd0');
  });

  it('keeps a full transaction of the longest memos under the 1,232-byte packet', async () => {
    const signer = await signerFromSecret(SECRET);
    const longest = memoText({ id: 99_999_999, address: MINT, time: 9_999_999_999, event_type: 'sell_trigger', score: 1 });
    const message = memoMessage(signer.publicKey, b58decode(BLOCKHASH), Array(MEMOS_PER_TX).fill(longest));
    expect(serializeTx(new Uint8Array(64), message).length).toBeLessThan(1232);
  });
});

describe('Helius pacing', () => {
  it('spaces Helius calls and retries a 429; other URLs go straight through', async () => {
    const { solanaRpc } = await import('./chain');
    const times: number[] = [];
    let refuse = 1;
    const real = globalThis.fetch;
    globalThis.fetch = (async () => {
      times.push(Date.now());
      if (refuse-- > 0) return new Response('', { status: 429 });
      return new Response(JSON.stringify({ result: 7 }));
    }) as typeof fetch;
    try {
      const url = 'https://mainnet.helius-rpc.com/?api-key=test';
      expect(await solanaRpc<number>(url, 'getSlot', [])).toBe(7); // 429, wait, then 7
      expect(await solanaRpc<number>(url, 'getSlot', [])).toBe(7);
      expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(1900);
      expect(times[2]! - times[1]!).toBeGreaterThanOrEqual(550);
      refuse = 1;
      await expect(solanaRpc('https://rpc', 'getSlot', [])).rejects.toThrow('getSlot: HTTP 429');
    } finally {
      globalThis.fetch = real;
    }
  }, 10_000);
});
