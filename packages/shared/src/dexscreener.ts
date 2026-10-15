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

export class DexScreenerClient {
  constructor(private base: string = DEFAULT_BASE) {}

  /** Failed requests of this client, for the caller's log ("/token-boosts/top/v1 HTTP 429"). */
  errors: string[] = [];

  private async getJson<T>(url: string): Promise<T | null> {
    const path = new URL(url).pathname;
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) {
        this.errors.push(`${path} HTTP ${res.status}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.errors.push(`${path} ${(err as Error).message}`);
      return null;
    }
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
