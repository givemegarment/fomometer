/**
 * The X account: every BUY signal once it is on Solana, its 4-hour result as a reply (wins and
 * losses alike), a daily summary and a weekly one. At most one post per POST_GAP_SEC. Cards
 * come from the site (/api/card/*); text is built here.
 *
 * Links: X charges $0.200 for a post with a URL against $0.015 without (since April 2026) and
 * shows linked posts to fewer people. Only the weekly summary carries one (with ?ref=x, counted on
 * the site); everything else has none, not even a bare domain, which X would turn into a link.
 * The site is on the card image and in the profile.
 *
 * X_POST_MODE: 'off' (default) does nothing; 'dry' builds each post and logs it, writing the
 * x_posts row with status 'dry' so it is not built again; 'live' posts. Live never reads dry rows.
 */

import { createPost, uploadImage, type XKeys } from './x';

/** Minimum gap between posts. */
const POST_GAP_SEC = 10 * 60;
/** A BUY older than this is not posted: it would read as hindsight. */
const SIGNAL_MAX_AGE_SEC = 30 * 60;
/** Daily summary at this UTC hour; the weekly one on Mondays at the same hour. */
const SUMMARY_HOUR_UTC = 9;
/** After this many failures a post is given up and logged. */
const MAX_ATTEMPTS = 3;

type Env = {
  DB: D1Database;
  X_POST_MODE?: string;
  /** Posts a calendar month; new signals stop first so every posted signal still gets its result. */
  X_MONTHLY_CAP?: string;
  SITE_URL?: string;
  X_API_KEY?: string;
  X_API_SECRET?: string;
  X_ACCESS_TOKEN?: string;
  X_ACCESS_SECRET?: string;
};

export type Post = { kind: 'signal' | 'outcome' | 'daily' | 'weekly'; ref: string; text: string; card: string; replyTo?: string };

// --- text ---------------------------------------------------------------------------------------

const SUB = '₀₁₂₃₄₅₆₇₈₉';
/** Price as on the site: $0.0₃6707 for tiny prices. */
export function priceText(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '·';
  if (v >= 0.001) return `$${Number(v >= 1 ? v.toFixed(4) : v.toPrecision(4))}`;
  let exp = Math.floor(Math.log10(v));
  let sig = Math.round(v * 10 ** (3 - exp));
  if (sig >= 10000) {
    sig = Math.round(sig / 10);
    exp += 1;
  }
  const zeros = String(-exp - 1).split('').map((d) => SUB[Number(d)]).join('');
  return `$0.0${zeros}${String(sig).replace(/0+$/, '') || '0'}`;
}
export const pctText = (x: number | null) => (x == null || !Number.isFinite(x) ? 'n/a' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}%`);
const money = (n: number | null) =>
  n == null ? 'n/a' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
const ticker = (symbol: string, address: string) => `$${(symbol || address.slice(0, 6)).replace(/[^A-Za-z0-9_]/g, '').slice(0, 15) || address.slice(0, 6)}`;

export function signalText(s: {
  id: number;
  address: string;
  symbol: string;
  score: number;
  prev_score: number | null;
  threshold: number | null;
  price: number | null;
  liquidity: number | null;
  chain_sig: string;
}): string {
  const score = `Score ${s.prev_score != null ? `${Math.round(s.prev_score * 100)} → ` : ''}${Math.round(s.score * 100)}${
    s.threshold != null ? ` (threshold ${Math.round(s.threshold * 100)})` : ''
  }`;
  return [
    `${ticker(s.symbol, s.address)} BUY signal`,
    score,
    `Price ${priceText(s.price)} · Liquidity ${money(s.liquidity)}`,
    '',
    `Recorded on Solana before the move: tx ${s.chain_sig.slice(0, 4)}…${s.chain_sig.slice(-4)}`,
    `Signal #${s.id}. Result in 4 hours, win or lose. Not advice.`
  ].join('\n');
}

export function outcomeText(o: {
  pnl_4h: number | null;
  entry: number;
  best: number | null;
  worst: number | null;
  base_median: number | null;
}): string {
  if (o.pnl_4h == null) {
    return '4 hours later: no price. The token left the list and had no trade data at the 4-hour mark. It counts as missing on the Strategy page, not as a win.';
  }
  return [
    `4 hours later: ${pctText(o.pnl_4h)} (${priceText(o.entry)} → ${priceText(o.entry * (1 + o.pnl_4h / 100))})`,
    `Inside the 4 hours: best ${pctText(o.best)}, worst ${pctText(o.worst)}`,
    o.base_median == null ? '' : `Any tracked token, same window: ${pctText(o.base_median)}`,
    'Before fees and slippage.'
  ]
    .filter(Boolean)
    .join('\n');
}

export function summaryText(days: 1 | 7, s: { priced: number; share: number | null; median: number | null; base_share: number | null; base_median: number | null }, site: string) {
  const head = days === 7 ? 'BUY signals, last 7 days' : 'BUY signals, last 24 hours';
  // The weekly post is the one with a link; the daily one points to the profile.
  const tail = days === 7 ? `Every signal and its result: ${site}/dashboard/strategy?ref=x` : 'Every signal and its result: link in bio.';
  if (!s.priced) return `${head}: none with a 4-hour result yet.\n\n${tail}`;
  return [
    `${head}: ${s.priced} with a 4-hour result.`,
    `Higher after 4h: ${s.share == null ? 'n/a' : `${Math.round(s.share)}%`} (any token ${s.base_share == null ? 'n/a' : `${Math.round(s.base_share)}%`})`,
    `Median after 4h: ${pctText(s.median)} (any token ${pctText(s.base_median)})`,
    '',
    tail
  ].join('\n');
}

// --- selection ----------------------------------------------------------------------------------

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
const share = (xs: number[]) => (xs.length ? (xs.filter((x) => x > 0).length / xs.length) * 100 : null);

/** The next post to make, by priority: summaries, then results owed, then new signals. */
export async function nextPost(env: Env, now: number, mode: 'dry' | 'live', capLeft: number): Promise<Post | null> {
  const db = env.DB;
  const site = env.SITE_URL ?? 'https://fomometer.xyz';
  const posted = async (kind: string, ref: string) =>
    (await db.prepare(`SELECT 1 AS x FROM x_posts WHERE kind = ? AND ref = ? AND mode = ? AND status != 'retry'`).bind(kind, ref, mode).first()) != null;

  // 1. Summaries at SUMMARY_HOUR_UTC: daily every day, weekly on Mondays.
  const d = new Date(now * 1000);
  if (d.getUTCHours() >= SUMMARY_HOUR_UTC) {
    const day = d.toISOString().slice(0, 10);
    for (const days of (d.getUTCDay() === 1 ? [7, 1] : [1]) as Array<1 | 7>) {
      const kind = days === 7 ? 'weekly' : 'daily';
      if (await posted(kind, day)) continue;
      const end = now - 4 * 3600 - 600;
      const start = end - days * 86400;
      const [buys, base] = await Promise.all([
        db
          .prepare(`SELECT pnl_pct_4h AS p FROM signal_outcomes WHERE event_type = 'buy_trigger' AND event_time BETWEEN ? AND ? AND price_flag IS NULL AND pnl_pct_4h IS NOT NULL`)
          .bind(start, end)
          .all<{ p: number }>(),
        db
          .prepare(`SELECT (price_4h / entry_price - 1) * 100 AS p FROM baseline_outcomes WHERE sample_time BETWEEN ? AND ? AND price_4h IS NOT NULL AND entry_price > 0`)
          .bind(start, end)
          .all<{ p: number }>()
      ]);
      const p = (buys.results ?? []).map((r) => r.p);
      const b = (base.results ?? []).map((r) => r.p);
      return {
        kind,
        ref: day,
        text: summaryText(days, { priced: p.length, share: share(p), median: median(p), base_share: share(b), base_median: median(b) }, site),
        card: `${site}/api/card/summary?days=${days}`
      };
    }
  }

  // 2. Results owed: every posted signal gets its 4-hour reply.
  const owed = await db
    .prepare(
      `SELECT s.ref, s.tweet_id, o.entry_price, o.pnl_pct_4h, o.max_pnl_pct_4h, o.min_pnl_pct_4h, o.event_time
         FROM x_posts s JOIN signal_outcomes o ON o.event_id = CAST(s.ref AS INTEGER)
        WHERE s.kind = 'signal' AND s.mode = ? AND s.status IN ('posted', 'dry')
          AND NOT EXISTS (SELECT 1 FROM x_posts r WHERE r.kind = 'outcome' AND r.ref = s.ref AND r.mode = ? AND r.status != 'retry')
        ORDER BY o.event_time LIMIT 1`
    )
    .bind(mode, mode)
    .first<{ ref: string; tweet_id: string | null; entry_price: number; pnl_pct_4h: number | null; max_pnl_pct_4h: number | null; min_pnl_pct_4h: number | null; event_time: number }>();
  if (owed) {
    const base = await db
      .prepare(`SELECT (price_4h / entry_price - 1) * 100 AS p FROM baseline_outcomes WHERE sample_time BETWEEN ? AND ? AND price_4h IS NOT NULL AND entry_price > 0`)
      .bind(owed.event_time - 1800, owed.event_time + 1800)
      .all<{ p: number }>();
    return {
      kind: 'outcome',
      ref: owed.ref,
      text: outcomeText({
        pnl_4h: owed.pnl_pct_4h,
        entry: owed.entry_price,
        best: owed.max_pnl_pct_4h,
        worst: owed.min_pnl_pct_4h,
        base_median: median((base.results ?? []).map((r) => r.p))
      }),
      card: `${site}/api/card/outcome/${owed.ref}`,
      replyTo: owed.tweet_id ?? undefined
    };
  }

  // 3. New BUY signals that landed on Solana, newest first, while the cap leaves room for
  //    their results.
  if (capLeft <= 1) return null;
  const sig = await db
    .prepare(
      `SELECT e.id, e.address, e.score, e.prev_score, json_extract(e.metadata_json, '$.threshold') AS threshold, e.chain_sig,
              COALESCE(t.symbol, '') AS symbol,
              (SELECT price_usd FROM token_snapshots s WHERE s.address = e.address AND s.time <= e.time ORDER BY s.time DESC LIMIT 1) AS price,
              (SELECT liquidity_usd FROM token_snapshots s WHERE s.address = e.address AND s.time <= e.time ORDER BY s.time DESC LIMIT 1) AS liquidity
         FROM signal_events e LEFT JOIN tokens t ON t.address = e.address
        WHERE e.event_type = 'buy_trigger' AND e.time >= ? AND e.chain_ok = 1
          AND NOT EXISTS (SELECT 1 FROM x_posts p WHERE p.kind = 'signal' AND p.ref = CAST(e.id AS TEXT) AND p.mode = ? AND p.status != 'retry')
        ORDER BY e.id DESC LIMIT 1`
    )
    .bind(now - SIGNAL_MAX_AGE_SEC, mode)
    .first<{ id: number; address: string; score: number; prev_score: number | null; threshold: number | null; chain_sig: string; symbol: string; price: number | null; liquidity: number | null }>();
  if (!sig) return null;
  return {
    kind: 'signal',
    ref: String(sig.id),
    text: signalText(sig),
    card: `${site}/api/card/signal/${sig.id}`
  };
}

// --- run ----------------------------------------------------------------------------------------

/** One post at most per run. Returns what happened, for the log line. */
export async function runSocial(env: Env, now = Math.floor(Date.now() / 1000)): Promise<string | null> {
  const mode = env.X_POST_MODE === 'live' ? 'live' : env.X_POST_MODE === 'dry' ? 'dry' : null;
  if (!mode) return null;
  const db = env.DB;
  if (mode === 'live') {
    const last = await db
      .prepare(`SELECT MAX(posted_at) AS t FROM x_posts WHERE mode = 'live' AND status = 'posted'`)
      .first<{ t: number | null }>();
    if (last?.t && now - last.t < POST_GAP_SEC) return null;
  }
  const monthStart = Math.floor(Date.UTC(new Date(now * 1000).getUTCFullYear(), new Date(now * 1000).getUTCMonth(), 1) / 1000);
  const used = await db
    .prepare(`SELECT COUNT(*) AS n FROM x_posts WHERE mode = ? AND status IN ('posted', 'dry') AND posted_at >= ?`)
    .bind(mode, monthStart)
    .first<{ n: number }>();
  const cap = parseInt(env.X_MONTHLY_CAP ?? '', 10) || 1300;
  const capLeft = cap - (used?.n ?? 0);
  if (capLeft <= 0) return 'x cap reached';

  // A post that failed before is retried as the same row; after MAX_ATTEMPTS it is given up.
  const post = await nextPost(env, now, mode, capLeft);
  if (!post) return null;

  if (mode === 'dry') {
    await db
      .prepare(`INSERT INTO x_posts (kind, ref, mode, status, text, card, reply_to, posted_at) VALUES (?, ?, 'dry', 'dry', ?, ?, ?, ?)`)
      .bind(post.kind, post.ref, post.text, post.card, post.replyTo ?? null, now)
      .run();
    return `x dry ${post.kind} ${post.ref}: ${post.text.replace(/\n/g, ' | ').slice(0, 200)}`;
  }

  const keys: XKeys | null =
    env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET
      ? { apiKey: env.X_API_KEY, apiSecret: env.X_API_SECRET, accessToken: env.X_ACCESS_TOKEN, accessSecret: env.X_ACCESS_SECRET }
      : null;
  if (!keys) return 'x live without keys';

  const prior = await db
    .prepare(`SELECT attempts FROM x_posts WHERE kind = ? AND ref = ? AND mode = 'live'`)
    .bind(post.kind, post.ref)
    .first<{ attempts: number }>();
  try {
    const card = await fetch(post.card);
    if (!card.ok) throw new Error(`card ${card.status}`);
    const mediaId = await uploadImage(keys, await card.arrayBuffer());
    const id = await createPost(keys, post.text, mediaId, post.replyTo);
    await db
      .prepare(
        `INSERT INTO x_posts (kind, ref, mode, status, text, card, reply_to, tweet_id, attempts, posted_at)
         VALUES (?, ?, 'live', 'posted', ?, ?, ?, ?, ?, ?)
         ON CONFLICT(kind, ref, mode) DO UPDATE SET status = 'posted', tweet_id = excluded.tweet_id,
           attempts = excluded.attempts, posted_at = excluded.posted_at, error = NULL`
      )
      .bind(post.kind, post.ref, post.text, post.card, post.replyTo ?? null, id, (prior?.attempts ?? 0) + 1, now)
      .run();
    return `x posted ${post.kind} ${post.ref} ${id}`;
  } catch (err) {
    const attempts = (prior?.attempts ?? 0) + 1;
    const message = (err as Error).message.slice(0, 300);
    // Given up: status 'failed' with posted_at set, so it counts as handled and the queue moves on.
    await db
      .prepare(
        `INSERT INTO x_posts (kind, ref, mode, status, text, card, reply_to, attempts, error, posted_at)
         VALUES (?, ?, 'live', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(kind, ref, mode) DO UPDATE SET status = excluded.status, attempts = excluded.attempts,
           error = excluded.error, posted_at = excluded.posted_at`
      )
      .bind(post.kind, post.ref, attempts >= MAX_ATTEMPTS ? 'failed' : 'retry', post.text, post.card, post.replyTo ?? null, attempts, message, attempts >= MAX_ATTEMPTS ? now : null)
      .run();
    return `x error ${post.kind} ${post.ref} (attempt ${attempts}): ${message}`;
  }
}
