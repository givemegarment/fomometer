import { afterEach, describe, expect, it, vi } from 'vitest';
import { DexScreenerClient } from './dexscreener';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Answers in order; each entry is a status code. */
function answers(...codes: number[]) {
  let i = 0;
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const code = codes[Math.min(i++, codes.length - 1)]!;
    return code === 200
      ? new Response(JSON.stringify([{ chainId: 'solana', tokenAddress: 'A' }]))
      : new Response('slow down', { status: code });
  });
  return calls;
}

describe('DexScreenerClient retries', () => {
  it('retries a 429 with backoff and succeeds', async () => {
    vi.useFakeTimers();
    const calls = answers(429, 429, 200);
    const ds = new DexScreenerClient('https://x');
    const p = ds.getTrendingSolana();
    await vi.runAllTimersAsync();
    expect((await p).map((t) => t.tokenAddress)).toEqual(['A']);
    expect(ds.errors).toEqual([]);
    expect(ds.retries).toBeGreaterThan(0);
    expect(calls.length).toBeGreaterThanOrEqual(4); // two endpoints, at least one retried
  });

  it('gives up after 4 tries and says so', async () => {
    vi.useFakeTimers();
    const calls = answers(429);
    const ds = new DexScreenerClient('https://x');
    const p = ds.getTokensBatch(['A', 'B']);
    await vi.runAllTimersAsync();
    expect(await p).toEqual([]);
    expect(calls.length).toBe(4);
    expect(ds.errors).toEqual(['/tokens/v1/solana/… HTTP 429 after 4 tries']);
  });

  it('does not retry a 404', async () => {
    const calls = answers(404);
    const ds = new DexScreenerClient('https://x');
    expect(await ds.getTokensBatch(['A'])).toEqual([]);
    expect(calls.length).toBe(1);
    expect(ds.errors).toEqual(['/tokens/v1/solana/… HTTP 404 after 1 try']);
  });
});

describe('DexScreenerClient relays', () => {
  it('tries relays in turn after a 429 and counts the one that worked', async () => {
    answers(429);
    const used: string[] = [];
    const relay = (name: string, code: number) => async () => {
      used.push(name);
      return code === 200 ? new Response(JSON.stringify([{ chainId: 'solana', tokenAddress: 'A' }])) : new Response('', { status: code });
    };
    const ds = new DexScreenerClient('https://x', [relay('weur', 429), relay('apac', 200), relay('enam', 200)]);
    await ds.getTokensBatch(["A"]); // the payload is not a pair list; what matters is the route taken
    expect(used).toEqual(['weur', 'apac']);
    expect(ds.relayed).toBe(1);
    expect(ds.errors).toEqual([]);
  });
});
