/**
 * "Currently tracked" tokens: the engine took a price snapshot of them within
 * FRESH_WINDOW_SEC of its newest snapshot. Tokens that left the DexScreener list
 * keep old rows for 72h; this keeps them out of rankings.
 *
 * Snapshots are the reliable heartbeat (written every minute); scores can lag when
 * a scoring run fails, so the score comes from each token's latest signal row and
 * the price from its latest snapshot.
 */
export const FRESH_WINDOW_SEC = 10 * 60;

/**
 * CTEs exposing `tracked(address, st)` (latest snapshot time) and
 * `ls(address, t)` (latest signal time) for tracked tokens.
 * Join: tracked tr → tokens t, ls, signals s (s.time = ls.t), token_snapshots sn (sn.time = tr.st).
 */
export const TRACKED_CTE = `
  tracked AS (
    SELECT address, MAX(time) AS st FROM token_snapshots
    WHERE time >= (SELECT MAX(time) FROM token_snapshots) - ${FRESH_WINDOW_SEC}
    GROUP BY address
  ),
  ls AS (
    SELECT s.address, MAX(s.time) AS t FROM signals s
    JOIN tracked tr ON tr.address = s.address
    GROUP BY s.address
  )`;
