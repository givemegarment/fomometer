import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { DatabaseSync as DB } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { outcomeText, priceText, runSocial, signalText, summaryText } from './social';

// Loaded at runtime: vitest 2.1 does not resolve the node:sqlite builtin itself.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const MINT = 'DtcicPCKTKeAh7TDEzTym3hXeoHAoMiBdYJhMYxZpump';
/** 15 Oct 2026 20:00 UTC, a Thursday, after the 09:00 summary hour. */
const NOW = Date.UTC(2026, 9, 15, 20, 0, 0) / 1000;

function d1() {
  const db: DB = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../infra/d1-schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    first: async () => db.prepare(sql).get(...(args as never[])) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(args as never[])).changes) } })
  });
  return { raw: db, DB: { prepare: (sql: string) => stmt(sql) } as unknown as D1Database };
}

function seed(db: DB) {
  db.prepare(`INSERT INTO tokens (address, symbol) VALUES (?, 'CBUCKS')`).run(MINT);
  db.prepare(`INSERT INTO token_snapshots (address, time, price_usd, liquidity_usd) VALUES (?, ?, 0.0006707, 92300)`).run(MINT, NOW - 300);
  db.prepare(
    `INSERT INTO signal_events (id, address, time, event_type, score, prev_score, metadata_json, chain_sig, chain_ok)
     VALUES (47100, ?, ?, 'buy_trigger', 0.73, 0.67, '{"threshold":0.7}', 'SIGabc', 1)`
  ).run(MINT, NOW - 240);
  // Daily summary for today already handled, so the queue reaches signals.
  db.prepare(`INSERT INTO x_posts (kind, ref, mode, status, text, card, posted_at) VALUES ('daily', '2026-10-15', ?, 'posted', '', '', ?)`).run('dry', NOW - 3 * 3600);
  db.prepare(`INSERT INTO x_posts (kind, ref, mode, status, text, card, posted_at) VALUES ('daily', '2026-10-15', ?, 'posted', '', '', ?)`).run('live', NOW - 3 * 3600);
}

afterEach(() => vi.unstubAllGlobals());

describe('post text', () => {
  it('prints prices as the site does', () => {
    expect(priceText(0.0006707)).toBe('$0.0₃6707');
    expect(priceText(0.001209)).toBe('$0.001209');
    expect(priceText(null)).toBe('·');
  });

  it('keeps a signal post under 280 characters, cashtag first', () => {
    const t = signalText({ id: 47100, address: MINT, symbol: 'CBUCKS', score: 0.73, prev_score: 0.67, threshold: 0.7, price: 0.0006707, liquidity: 92300, chain_sig: '5g578MbG' + 'x'.repeat(72) + 'gsibt' });
    expect(t.length).toBeLessThanOrEqual(280);
    expect(t.startsWith('$CBUCKS BUY signal')).toBe(true);
    expect(t).toContain('Score 67 → 73 (threshold 70)');
    expect(t).toContain('tx 5g57…sibt');
  });

  it('puts no link and no bare domain anywhere but the weekly summary (X charges $0.20 for those)', () => {
    // What X auto-links: a scheme or anything shaped like host.tld.
    const linky = /https?:\/\/|\b[a-z0-9-]+\.(?:xyz|io|com|net|org|app|fun)\b/i;
    const sig = signalText({ id: 1, address: MINT, symbol: 'CBUCKS', score: 0.7, prev_score: 0.6, threshold: 0.7, price: 0.001, liquidity: 50000, chain_sig: 'x'.repeat(88) });
    const out = outcomeText({ pnl_4h: 12, entry: 0.001, best: 30, worst: -5, base_median: 0 });
    const lost = outcomeText({ pnl_4h: null, entry: 0.001, best: null, worst: null, base_median: null });
    const s = { priced: 10, share: 40, median: -2, base_share: 35, base_median: -1 };
    for (const t of [sig, out, lost, summaryText(1, s, 'https://fomometer.xyz'), summaryText(1, { ...s, priced: 0 }, 'https://fomometer.xyz')]) {
      expect(t).not.toMatch(linky);
    }
    expect(summaryText(7, s, 'https://fomometer.xyz')).toContain('https://fomometer.xyz/dashboard/strategy?ref=x');
  });

  it('reports a loss and a missing price plainly', () => {
    expect(outcomeText({ pnl_4h: -8.04, entry: 0.0006, best: 3, worst: -20, base_median: -1.2 })).toMatch(/^4 hours later: −8\.0%/);
    expect(outcomeText({ pnl_4h: null, entry: 0.0006, best: null, worst: null, base_median: null })).toMatch(/no price/);
  });
});

describe('runSocial', () => {
  it('does nothing while off', async () => {
    const { DB } = d1();
    expect(await runSocial({ DB, X_POST_MODE: 'off' }, NOW)).toBeNull();
  });

  it('dry mode: posts the landed BUY, then its result once the outcome exists', async () => {
    const { raw, DB } = d1();
    seed(raw);
    expect(await runSocial({ DB, X_POST_MODE: 'dry' }, NOW)).toMatch(/^x dry signal 47100: \$CBUCKS BUY signal/);
    expect(await runSocial({ DB, X_POST_MODE: 'dry' }, NOW + 60)).toBeNull(); // nothing new
    raw
      .prepare(
        `INSERT INTO signal_outcomes (event_id, address, event_time, event_type, entry_price, pnl_pct_4h, max_pnl_pct_4h, min_pnl_pct_4h)
         VALUES (47100, ?, ?, 'buy_trigger', 0.0006707, -8.04, 3, -20)`
      )
      .run(MINT, NOW - 240);
    expect(await runSocial({ DB, X_POST_MODE: 'dry' }, NOW + 120)).toMatch(/^x dry outcome 47100: 4 hours later: −8\.0%/);
  });

  it('does not post a BUY that did not land on Solana or is over 30 minutes old', async () => {
    const { raw, DB } = d1();
    seed(raw);
    raw.prepare(`UPDATE signal_events SET chain_ok = NULL`).run();
    expect(await runSocial({ DB, X_POST_MODE: 'dry' }, NOW)).toBeNull();
    raw.prepare(`UPDATE signal_events SET chain_ok = 1, time = ?`).run(NOW - 40 * 60);
    expect(await runSocial({ DB, X_POST_MODE: 'dry' }, NOW)).toBeNull();
  });

  it('posts the daily summary first after 09:00 UTC', async () => {
    const { raw, DB } = d1();
    seed(raw);
    raw.prepare(`DELETE FROM x_posts WHERE kind = 'daily'`).run();
    expect(await runSocial({ DB, X_POST_MODE: 'dry' }, NOW)).toMatch(/^x dry daily 2026-10-15: BUY signals, last 24 hours/);
  });

  it('live: retries after an X error, keeps the 10-minute gap, and stores the post id', async () => {
    const { raw, DB } = d1();
    seed(raw);
    let fail = true;
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/api/card/')) return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
      if (url.endsWith('/2/media/upload')) {
        if (fail) return new Response('{"title":"Too Many Requests"}', { status: 429 });
        return new Response(JSON.stringify({ data: { id: 'M1' } }));
      }
      if (url.endsWith('/2/tweets')) return new Response(JSON.stringify({ data: { id: 'T1' } }));
      throw new Error(`unexpected ${url}`);
    });
    const env = { DB, X_POST_MODE: 'live', X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_SECRET: 'u' };
    expect(await runSocial(env, NOW)).toMatch(/^x error signal 47100 \(attempt 1\): X \/2\/media\/upload: HTTP 429/);
    fail = false;
    expect(await runSocial(env, NOW + 60)).toBe('x posted signal 47100 T1');
    const row = raw.prepare(`SELECT status, tweet_id, attempts FROM x_posts WHERE kind = 'signal'`).get();
    expect(row).toEqual({ status: 'posted', tweet_id: 'T1', attempts: 2 });
    // The daily row was posted 3 h ago, the signal just now: the next run waits.
    raw.prepare(`INSERT INTO signal_events (id, address, time, event_type, score, chain_sig, chain_ok) VALUES (47101, ?, ?, 'buy_trigger', 0.8, 'SIGdef', 1)`).run(MINT, NOW);
    expect(await runSocial(env, NOW + 120)).toBeNull();
  });

  it('live: two runs at once post a signal only once', async () => {
    const { raw, DB } = d1();
    seed(raw);
    let tweets = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/api/card/')) return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
      if (url.endsWith('/2/media/upload')) return new Response(JSON.stringify({ data: { id: 'M1' } }));
      if (url.endsWith('/2/tweets')) return new Response(JSON.stringify({ data: { id: `T${++tweets}` } }));
      throw new Error(`unexpected ${url}`);
    });
    const env = { DB, X_POST_MODE: 'live', X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_SECRET: 'u' };
    const results = await Promise.all([runSocial(env, NOW), runSocial(env, NOW)]);
    expect(tweets).toBe(1);
    expect(results.filter((r) => r?.startsWith('x posted signal 47100'))).toHaveLength(1);
    expect(raw.prepare(`SELECT status, tweet_id FROM x_posts WHERE kind = 'signal'`).get()).toEqual({ status: 'posted', tweet_id: 'T1' });
  });
});
