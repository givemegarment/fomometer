/**
 * DexScreener API client (free, no auth).
 * https://docs.dexscreener.com/api/reference
 *
 * Rate-limit per endpoint: 60 req/min. We use:
 *  - GET /metas/trending/v1?chainIds=solana  → top trending tokens (ids only)
 *  - GET /tokens/v1/solana/{addr1,addr2,...} → batch snapshot for up to 30 addrs
 */

const DEFAULT_BASE = 'https://api.dexscreener.com';

export type DsPair = {
  chainId: string;
  dexId: string;
  url?: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken?: { address: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceNative?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    h6?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
  info?: { imageUrl?: string; websites?: { url: string }[]; socials?: { type: string; url: string }[] };
};

export type DsTrendingItem = {
  chainId: string;
  tokenAddress: string;
  symbol?: string;
  name?: string;
};

export type DsBoostItem = {
  chainId?: string;
  tokenAddress?: string;
  amount?: number;
  totalAmount?: number;
  description?: string;
  links?: { url: string }[];
};

const USER_AGENT = 'fomometer-engine/1.0 (+https://fomometer.xyz)';
/**
 * Waits before retry 1, 2 and 3. From Cloudflare, DexScreener answers 429 for some egress
 * addresses and not others (the limit is shared with every other Worker), so a later attempt
 * often goes through. Jitter keeps retries from landing together; Retry-After is honoured up to
 * MAX_WAIT_MS. Waiting costs wall time, not CPU.
 */
const RETRY_DELAYS_MS = [2000, 5000, 10000];
const MAX_WAIT_MS = 10000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryable = (status: number) => status === 429 || status >= 500;

export class DexScreenerClient {
  constructor(private base: string = DEFAULT_BASE) {}

  /** Requests that failed after every attempt, for the caller's log ("/token-boosts/top/v1 HTTP 429 after 4 tries"). */
  errors: string[] = [];
  /** Attempts beyond the first, across all requests of this client. */
  retries = 0;

  private async getJson<T>(url: string): Promise<T | null> {
    const path = new URL(url).pathname.replace(/^(\/tokens\/v1\/solana\/).+$/, '$1…');
    let last = '';
    let tries = 0;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      tries++;
      try {
        // A Worker sends no user agent by default; sites behind Cloudflare throttle such clients harder.
        const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT } });
        if (res.ok) return (await res.json()) as T;
        last = `HTTP ${res.status}`;
        if (!retryable(res.status) || attempt === RETRY_DELAYS_MS.length) break;
        const after = Number(res.headers.get('retry-after')) * 1000;
        const base = RETRY_DELAYS_MS[attempt]!;
        await sleep(Math.min(MAX_WAIT_MS, Number.isFinite(after) && after > 0 ? after : base * (0.75 + Math.random() / 2)));
      } catch (err) {
        last = (err as Error).message;
        if (attempt === RETRY_DELAYS_MS.length) break;
        await sleep(RETRY_DELAYS_MS[attempt]!);
      }
      this.retries++;
    }
    this.errors.push(`${path} ${last} after ${tries} ${tries === 1 ? 'try' : 'tries'}`);
    return null;
  }

  /**
   * Returns trending Solana tokens by union of /token-boosts/top + /token-boosts/latest.
   * `/metas/trending/v1` returns category metadata, not token lists, so we use the
   * boosts endpoints instead — these track most-promoted tokens across the platform
   * and are a reasonable proxy for "trending" without an explicit trending API.
   * Empty when both fail: the caller decides what to do (no fallback to a keyword search,
   * which would mix tokens that are not promoted into the universe).
   */
  async getTrendingSolana(): Promise<DsTrendingItem[]> {
    const [top, latest] = await Promise.all([
      this.getJson<DsBoostItem[]>(`${this.base}/token-boosts/top/v1`),
      this.getJson<DsBoostItem[]>(`${this.base}/token-boosts/latest/v1`)
    ]);

    const seen = new Set<string>();
    const out: DsTrendingItem[] = [];
    const consume = (arr: DsBoostItem[] | null) => {
      if (!Array.isArray(arr)) return;
      for (const x of arr) {
        if (x?.chainId !== 'solana' || !x.tokenAddress) continue;
        if (seen.has(x.tokenAddress)) continue;
        seen.add(x.tokenAddress);
        out.push({ chainId: 'solana', tokenAddress: x.tokenAddress });
      }
    };
    consume(top);
    consume(latest);

    return out;
  }

  /**
   * Batch fetch up to 30 token addresses on Solana — returns the most-liquid pair per token.
   */
  async getTokensBatch(addresses: ReadonlyArray<string>): Promise<DsPair[]> {
    if (addresses.length === 0) return [];
    if (addresses.length > 30) {
      // Caller should batch — be explicit.
      throw new Error('DexScreener: max 30 addresses per call');
    }
    const url = `${this.base}/tokens/v1/solana/${addresses.join(',')}`;
    const j = await this.getJson<DsPair[] | { pairs?: DsPair[] }>(url);
    if (!j) return [];
    const arr = Array.isArray(j) ? j : (j.pairs ?? []);
    // Pick the most-liquid pair per token address.
    const byToken = new Map<string, DsPair>();
    for (const p of arr) {
      const a = p.baseToken?.address;
      if (!a) continue;
      const cur = byToken.get(a);
      const liq = p.liquidity?.usd ?? 0;
      if (!cur || (cur.liquidity?.usd ?? 0) < liq) byToken.set(a, p);
    }
    return Array.from(byToken.values());
  }
}

/** Shape DexScreener pair into our Snapshot row. */
export function pairToSnapshot(p: DsPair, time: number): import('./types').Snapshot {
  const liq = p.liquidity?.usd ?? 0;
  const v = p.volume ?? {};
  const c = p.priceChange ?? {};
  const t = p.txns ?? {};
  return {
    address: p.baseToken.address,
    time,
    price_usd: p.priceUsd ? parseFloat(p.priceUsd) : 0,
    price_native: p.priceNative ? parseFloat(p.priceNative) : null,
    market_cap: p.marketCap ?? null,
    fdv: p.fdv ?? null,
    liquidity_usd: liq,
    volume_m5: v.m5 ?? 0,
    volume_h1: v.h1 ?? 0,
    volume_h6: v.h6 ?? 0,
    volume_h24: v.h24 ?? 0,
    price_change_m5: c.m5 ?? 0,
    price_change_h1: c.h1 ?? 0,
    price_change_h6: c.h6 ?? 0,
    price_change_h24: c.h24 ?? 0,
    buys_h1: t.h1?.buys ?? 0,
    sells_h1: t.h1?.sells ?? 0
  };
}
