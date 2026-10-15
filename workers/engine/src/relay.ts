import { DurableObject } from 'cloudflare:workers';

/**
 * Fetches DexScreener from the region this object lives in. DexScreener answers HTTP 429 to
 * some Cloudflare locations and not others; the engine's cron runs wherever Cloudflare puts it,
 * so when a request is refused it is repeated through relays pinned to other regions
 * (locationHint). Only api.dexscreener.com, GET, no state kept.
 */
export class DsRelay extends DurableObject {
  override async fetch(req: Request): Promise<Response> {
    const target = new URL(req.url).searchParams.get('u') ?? '';
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return new Response('bad url', { status: 400 });
    }
    if (url.protocol !== 'https:' || url.hostname !== 'api.dexscreener.com') return new Response('not allowed', { status: 403 });
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json', 'user-agent': 'fomometer-engine/1.0 (+https://fomometer.xyz)' }
    });
    return new Response(res.body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json', 'retry-after': res.headers.get('retry-after') ?? '' }
    });
  }
}

/** Regions for relays (Durable Object location hints). */
export const RELAY_REGIONS = ['weur', 'enam', 'apac', 'wnam', 'eeur', 'oc'] as const;
