/**
 * Shadow tracking of pump.fun graduates (the labeler fills pump_graduates from the chain).
 *
 * A graduate is screened once, SCREEN_AGE_SEC after its migration, a few hours before the age rule
 * lets it emit: liquidity at or above the engine's filter makes it active. Active graduates that
 * are not in the boosted list are fetched with it, scored with the same factors, normalization,
 * regime and thresholds, and their events go to shadow_events only. They never enter the
 * population statistics, the thresholds or the signals table, so live signals and the site are
 * unchanged. Graduates that fail the screen are not stored as tokens or snapshots.
 *
 * Cost bound: at most SHADOW_MAX tokens a run (one extra DexScreener call), screening every
 * SCREEN_EVERY_SEC in batches of up to SCREEN_MAX.
 */
export const SHADOW_MAX = 30;
/** Screen 2 h before the 48 h age rule, so the window is warm by the time events are allowed. */
const SCREEN_AGE_SEC = 46 * 3600;
export const SCREEN_EVERY_SEC = 15 * 60;
const SCREEN_MAX = 60;
/** Graduates older than this leave the active set and, once inactive, the table. */
const SHADOW_MAX_AGE_SEC = 7 * 86400;
/** Keep fetching a token this long after a shadow event, for its 4 h outcome. */
const POST_EVENT_SEC = 4 * 3600 + 10 * 60;

export type ShadowPlan = {
  /** Graduates due for their one screen this run. */
  due: string[];
  /** Active graduates, newest first, mint → migration time. */
  active: Map<string, number>;
  /** Tokens with a shadow event in the last POST_EVENT_SEC (fetched for the labeler). */
  postEvent: string[];
};

export async function loadShadow(db: D1Database, now: number, screen: boolean): Promise<ShadowPlan> {
  const [due, active, post] = await db.batch<{ mint?: string; address?: string; migrated_at?: number }>([
    db
      .prepare(`SELECT mint FROM pump_graduates WHERE checked_at IS NULL AND migrated_at <= ? ORDER BY migrated_at LIMIT ?`)
      .bind(now - SCREEN_AGE_SEC, screen ? SCREEN_MAX : 0),
    db
      .prepare(`SELECT mint, migrated_at FROM pump_graduates WHERE active = 1 AND migrated_at >= ? ORDER BY migrated_at DESC LIMIT ?`)
      .bind(now - SHADOW_MAX_AGE_SEC, SHADOW_MAX),
    db.prepare(`SELECT DISTINCT address FROM shadow_events WHERE time >= ?`).bind(now - POST_EVENT_SEC)
  ]);
  return {
    due: (due!.results ?? []).map((r) => r.mint!),
    active: new Map((active!.results ?? []).map((r) => [r.mint!, r.migrated_at!])),
    postEvent: (post!.results ?? []).map((r) => r.address!)
  };
}

/**
 * Screen results and deactivations. A due graduate DexScreener did not return is screened as
 * failed only when its batch came back with pairs (`answered`), so a refused request does not
 * drop it. An active one leaves the set on a snapshot under the filter, never on a missing one.
 */
export function shadowUpdates(
  db: D1Database,
  now: number,
  plan: ShadowPlan,
  liquidity: Map<string, number>,
  minLiquidityUsd: number,
  answered: Set<string>
): { stmts: D1PreparedStatement[]; activated: string[] } {
  const stmts: D1PreparedStatement[] = [];
  const activated: string[] = [];
  for (const mint of plan.due) {
    const liq = liquidity.get(mint);
    if (liq == null && !answered.has(mint)) continue;
    const ok = liq != null && liq >= minLiquidityUsd;
    if (ok) activated.push(mint);
    stmts.push(
      db
        .prepare(`UPDATE pump_graduates SET checked_at = ?, liquidity_usd = ?, active = ? WHERE mint = ?`)
        .bind(now, liq ?? null, ok ? 1 : 0, mint)
    );
  }
  for (const mint of plan.active.keys()) {
    const liq = liquidity.get(mint);
    if (liq != null && liq < minLiquidityUsd) {
      stmts.push(db.prepare(`UPDATE pump_graduates SET active = 0, liquidity_usd = ? WHERE mint = ?`).bind(liq, mint));
    }
  }
  return { stmts, activated };
}

export function pruneShadow(db: D1Database, now: number, signalsCutoff: number): D1PreparedStatement[] {
  return [
    db.prepare(`DELETE FROM shadow_signals WHERE time < ?`).bind(signalsCutoff),
    db.prepare(`DELETE FROM shadow_events WHERE time < ?`).bind(signalsCutoff - 14 * 86400),
    db.prepare(`UPDATE pump_graduates SET active = 0 WHERE active = 1 AND migrated_at < ?`).bind(now - SHADOW_MAX_AGE_SEC),
    db.prepare(`DELETE FROM pump_graduates WHERE active = 0 AND migrated_at < ?`).bind(now - SHADOW_MAX_AGE_SEC)
  ];
}
