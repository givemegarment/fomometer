/**
 * Posting to X: OAuth 1.0a request signing (HMAC-SHA1, WebCrypto), media upload and posts.
 * The account's four keys are secrets; nothing here logs them or the Authorization header.
 */

export type XKeys = { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string };

const API = 'https://api.x.com';

/** RFC 3986 percent-encoding, as OAuth 1.0a requires. */
export const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

async function hmacSha1(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  return btoa(String.fromCharCode(...sig));
}

/**
 * OAuth 1.0a signature. `params` are the query and form-encoded body parameters; JSON and
 * multipart bodies are not signed. Nonce and timestamp are passed in so the result is testable.
 */
export async function oauthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  keys: XKeys,
  nonce: string,
  timestamp: string
): Promise<{ signature: string; oauth: Record<string, string> }> {
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: keys.accessToken,
    oauth_version: '1.0'
  };
  const all = { ...params, ...oauth };
  const paramString = Object.keys(all)
    .map((k) => [pct(k), pct(all[k]!)] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const base = `${method.toUpperCase()}&${pct(url)}&${pct(paramString)}`;
  const signature = await hmacSha1(`${pct(keys.apiSecret)}&${pct(keys.accessSecret)}`, base);
  return { signature, oauth };
}

async function authHeader(method: string, url: string, keys: XKeys): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const ts = String(Math.floor(Date.now() / 1000));
  const { signature, oauth } = await oauthSignature(method, url, {}, keys, nonce, ts);
  const all = { ...oauth, oauth_signature: signature };
  return 'OAuth ' + Object.keys(all).sort().map((k) => `${pct(k)}="${pct(all[k as keyof typeof all])}"`).join(', ');
}

async function xFetch(method: string, path: string, keys: XKeys, body: BodyInit, contentType?: string): Promise<unknown> {
  const url = `${API}${path}`;
  const headers: Record<string, string> = { authorization: await authHeader(method, url, keys) };
  if (contentType) headers['content-type'] = contentType;
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  // Errors keep the status and X's message, never the request headers.
  if (!res.ok) throw new Error(`X ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/** Uploads a PNG and returns its media id (v2 media upload, one request for images). */
export async function uploadImage(keys: XKeys, png: ArrayBuffer): Promise<string> {
  const form = new FormData();
  form.append('media', new Blob([png], { type: 'image/png' }), 'card.png');
  form.append('media_category', 'tweet_image');
  const r = (await xFetch('POST', '/2/media/upload', keys, form)) as { data?: { id?: string } };
  if (!r?.data?.id) throw new Error('X media upload: no id');
  return r.data.id;
}

/** Posts text with an optional image, optionally as a reply. Returns the post id. */
export async function createPost(keys: XKeys, text: string, mediaId?: string, replyTo?: string): Promise<string> {
  const body: Record<string, unknown> = { text };
  if (mediaId) body.media = { media_ids: [mediaId] };
  if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };
  const r = (await xFetch('POST', '/2/tweets', keys, JSON.stringify(body), 'application/json')) as { data?: { id?: string } };
  if (!r?.data?.id) throw new Error('X post: no id');
  return r.data.id;
}
