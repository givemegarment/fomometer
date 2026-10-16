/**
 * Paper portfolios: entry rules fixed on 16 Oct 2026 from the in-sample search over 72 h of minute
 * snapshots (docs/JOURNAL-BACKEND.md, "Потолок in-sample"), now measured forward. Nothing here is
 * shown on the site or traded. Rules and exits are frozen: a changed one gets a new id, so results
 * never mix.
 *
 * Entries: every scored token's snapshot is checked against every rule each run; a match opens a
 * trade at that minute's price unless the same rule already holds the token.
 * Exits: every open trade is checked each minute against each exit in EXITS on the token's price
 * that minute (take-profit fills at its level, as a limit order; stops and trailing stops at the
 * minute's price, as a market order). The trade closes HOLD_SEC after entry: the 4 h hold exit,
 * and every exit that has not fired yet, take that price. COST_PCT is taken off every exit.
 * 'stale' when no price came within STALE_SEC after the horizon (the latest stored price is used);
 * 'pool_switch' when the price rose more than 1000 % (a switch to another pool, as in the labeler).
 */
import type { Snapshot } from '@fomometer/shared';

export const HOLD_SEC = 4 * 3600;
export const COST_PCT = 3;
const STALE_SEC = 15 * 60;
const MIN_LIQ = 25_000;
const POOL_SWITCH = 11; // price ratio

type Rule = { id: string; match: (s: Snapshot) => boolean };

const between = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v < hi;

export const RULES: Rule[] = [
  // Control: every tradeable token. A rule is only worth anything if it beats this.
  { id: 'control', match: () => true },
  { id: 'r1_quiet5m_flat', match: (s) => between(s.volume_m5, 1, 110) && between(s.price_change_m5, 0, 1.04) },
  { id: 'r2_fdv52_315k_flat6h', match: (s) => between(s.fdv ?? NaN, 52_100, 315_000) && between(s.price_change_h6, -5.18, 4.74) },
  { id: 'r3_vol1h_3_22k_vol24_731k', match: (s) => between(s.volume_h1, 3_330, 22_500) && s.volume_h24 >= 731_000 },
  { id: 'r4_vol24_18_67k_flat5m', match: (s) => between(s.volume_h24, 18_100, 66_900) && between(s.price_change_m5, 0, 1.04) }
];

/** Price-driven exits, in % of the entry price; trailing is % below the highest price since entry. */
type Exit = { id: string; tp?: number; sl?: number; trail?: number };
export const EXITS: Exit[] = [
  { id: 'tp20_sl5', tp: 20, sl: -5 },
  { id: 'tp30_sl10', tp: 30, sl: -10 },
  { id: 'tp50_sl20', tp: 50, sl: -20 },
  { id: 'trail15', trail: 15 },
  { id: 'trail25', trail: 25 }
];

/** Rule ids a snapshot opens: tradeable liquidity first, then each rule. */
export function matchingRules(s: Snapshot): string[] {
  if (!Number.isFinite(s.liquidity_usd) || s.liquidity_usd < MIN_LIQ || !(s.price_usd > 0)) return [];
  return RULES.filter((r) => r.match(s)).map((r) => r.id);
}

/**
 * Return in % (before costs) at which an exit fires this minute, or null. `peak` is the highest
 * price since entry including this minute.
 */
export function exitReturn(x: Exit, entry: number, price: number, peak: number): number | null {
  const r = (price / entry - 1) * 100;
  if (x.sl != null && r <= x.sl) return r;
  if (x.tp != null && r >= x.tp) return x.tp;
  if (x.trail != null && price <= peak * (1 - x.trail / 100)) return r;
  return null;
}

type OpenTrade = { id: number; rule: string; address: string; entry_time: number; entry_price: number; peak_price: number | null };

/** Opens, exits and closes for this run. Call after this run's snapshots are stored. */
export async function paperStatements(
  db: D1Database,
  now: number,
  scored: Snapshot[],
  prices: Map<string, number>
): Promise<{ stmts: D1PreparedStatement[]; opened: number; closed: number; exits: number }> {
  const [openRes, doneRes] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT id, rule, address, entry_time, entry_price, peak_price FROM paper_trades WHERE exit_time IS NULL`),
    db.prepare(
      `SELECT x.trade_id, x.exit FROM paper_exits x JOIN paper_trades t ON t.id = x.trade_id WHERE t.exit_time IS NULL`
    )
  ]);
  const open = (openRes!.results ?? []) as OpenTrade[];
  const done = new Set(((doneRes!.results ?? []) as Array<{ trade_id: number; exit: string }>).map((d) => `${d.trade_id}|${d.exit}`));

  const stmts: D1PreparedStatement[] = [];
  const exitStmt = (id: number, exit: string, ret: number, reason: string) =>
    db
      .prepare(`INSERT OR IGNORE INTO paper_exits (trade_id, exit, exit_time, ret_pct, reason) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, exit, now, ret - COST_PCT, reason);
  let closed = 0;
  let exits = 0;

  for (const t of open) {
    const price = prices.get(t.address);
    const due = now - t.entry_time >= HOLD_SEC;
    if (price == null || !(price > 0)) {
      // No price this minute: wait, unless the horizon is long past; then the latest stored price.
      if (due && now - t.entry_time >= HOLD_SEC + STALE_SEC) {
        closed++;
        stmts.push(
          db
            .prepare(
              `UPDATE paper_trades SET exit_time = ?1, exit_reason = 'stale',
                 exit_price = (SELECT price_usd FROM token_snapshots s WHERE s.address = paper_trades.address ORDER BY s.time DESC LIMIT 1),
                 ret_pct = (SELECT price_usd FROM token_snapshots s WHERE s.address = paper_trades.address ORDER BY s.time DESC LIMIT 1) / entry_price * 100 - 100 - ?2
               WHERE id = ?3`
            )
            .bind(now, COST_PCT, t.id),
          db
            .prepare(
              `INSERT OR IGNORE INTO paper_exits (trade_id, exit, exit_time, ret_pct, reason)
               SELECT t.id, e.value, ?1, t.ret_pct, 'stale' FROM paper_trades t, json_each(?2) e WHERE t.id = ?3`
            )
            .bind(now, JSON.stringify(EXITS.map((x) => x.id)), t.id)
        );
      }
      continue;
    }
    const ratio = price / t.entry_price;
    const peak = Math.max(t.peak_price ?? t.entry_price, price);
    if (due || ratio > POOL_SWITCH) {
      closed++;
      const reason = ratio > POOL_SWITCH ? 'pool_switch' : 'hold';
      const ret = (ratio - 1) * 100;
      stmts.push(
        db
          .prepare(`UPDATE paper_trades SET exit_time = ?, exit_price = ?, exit_reason = ?, ret_pct = ?, peak_price = ? WHERE id = ?`)
          .bind(now, price, reason, ret - COST_PCT, peak, t.id)
      );
      for (const x of EXITS) if (!done.has(`${t.id}|${x.id}`)) stmts.push(exitStmt(t.id, x.id, ret, reason === 'hold' ? 'timeout' : reason));
      continue;
    }
    for (const x of EXITS) {
      if (done.has(`${t.id}|${x.id}`)) continue;
      const r = exitReturn(x, t.entry_price, price, peak);
      if (r != null) {
        exits++;
        stmts.push(exitStmt(t.id, x.id, r, 'fired'));
      }
    }
    if (peak !== t.peak_price) stmts.push(db.prepare(`UPDATE paper_trades SET peak_price = ? WHERE id = ?`).bind(peak, t.id));
  }

  const held = new Set(open.map((t) => `${t.rule}|${t.address}`));
  let opened = 0;
  for (const s of scored) {
    for (const rule of matchingRules(s)) {
      if (held.has(`${rule}|${s.address}`)) continue;
      opened++;
      stmts.push(
        db
          .prepare(`INSERT INTO paper_trades (rule, address, entry_time, entry_price, peak_price, liquidity_usd) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(rule, s.address, now, s.price_usd, s.price_usd, s.liquidity_usd)
      );
    }
  }
  return { stmts, opened, closed, exits };
}
