/**
 * "Currently tracked" tokens: the engine scored them within FRESH_WINDOW_SEC of its
 * newest score. Tokens that left the DexScreener list keep old rows for 72h, and
 * tokens followed only to price a past event get snapshots without scores; this
 * keeps both out of rankings. Price comes from each token's latest snapshot.
 */
export const FRESH_WINDOW_SEC = 10 * 60;

/**
 * CTEs exposing `tracked(address, st)` (latest snapshot time) and
 * `ls(address, t)` (latest signal time), both limited to the freshness window.
 * Join: tracked tr → tokens t, ls, signals s (s.time = ls.t), token_snapshots sn (sn.time = tr.st).
 *
 * `GROUP BY +address`: the unary plus stops SQLite from walking the whole
 * (address, time) index to group, so it reads only the time range
 * (about 300 rows instead of 130k per request).
 */
export const TRACKED_CTE = `
  tracked AS (
    SELECT address, MAX(time) AS st FROM token_snapshots
    WHERE time >= (SELECT MAX(time) FROM token_snapshots) - ${FRESH_WINDOW_SEC}
    GROUP BY +address
  ),
  ls AS (
    SELECT address, MAX(time) AS t FROM signals
    WHERE time >= (SELECT MAX(time) FROM signals) - ${FRESH_WINDOW_SEC}
    GROUP BY +address
  )`;
