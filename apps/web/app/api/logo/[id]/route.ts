import type { NextRequest } from 'next/server';

export const runtime = 'edge';

/** Token logos are DexScreener CMS image ids: cdn.dexscreener.com/cms/images/<id>. */
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
/** Sizes the DexScreener CDN accepts (other widths return 422). */
const SIZES = new Set(['64', '128', '256']);
const MAX_AGE = 7 * 86400;

/**
 * GET /api/logo/<id>?s=64|128|256
 * Serves a token logo from fomometer.xyz so visitors never request DexScreener's CDN
 * (which sets a third-party __cf_bm cookie). Upstream cookies are dropped; the image
 * is cached at the edge and in the browser for a week. Only CMS image ids are
 * accepted, so this is not an open proxy.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = req.nextUrl.searchParams.get('s') ?? '64';
  if (!ID_RE.test(params.id) || !SIZES.has(s)) return new Response(null, { status: 404 });

  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`https://fomometer.xyz/api/logo/${params.id}?s=${s}`);
  const hit = await cache?.match(key);
  if (hit) return hit;

  const upstream = await fetch(
    `https://cdn.dexscreener.com/cms/images/${params.id}?width=${s}&height=${s}&quality=90&format=webp`
  );
  const type = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !type.startsWith('image/')) return new Response(null, { status: 404 });

  const res = new Response(await upstream.arrayBuffer(), {
    headers: {
      'Content-Type': type,
      'Cache-Control': `public, max-age=${MAX_AGE}, immutable`
    }
  });
  await cache?.put(key, res.clone());
  return res;
}
