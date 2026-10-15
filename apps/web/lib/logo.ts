/**
 * DexScreener CMS logos are served through /api/logo (no third-party cookie, 64-256 px
 * instead of the 800 px default). The CDN only accepts 64, 128 and 256; pick the smallest
 * covering 2x density. Any other URL is used as is.
 */
export function logoSrc(src: string, px: number): string {
  try {
    const u = new URL(src);
    const m = u.hostname === 'cdn.dexscreener.com' ? /^\/cms\/images\/([A-Za-z0-9_-]{6,64})$/.exec(u.pathname) : null;
    if (!m) return src;
    const side = px * 2 <= 64 ? 64 : px * 2 <= 128 ? 128 : 256;
    return `/api/logo/${m[1]}?s=${side}`;
  } catch {
    return src;
  }
}
