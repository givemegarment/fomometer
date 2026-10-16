-- Paper portfolios (workers/engine/src/paper.ts): entry rules and exits fixed on 16 Oct 2026, measured forward.
-- Never shown on the site. Kept forever.
CREATE TABLE IF NOT EXISTS paper_trades (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  rule                TEXT NOT NULL,
  address             TEXT NOT NULL,
  entry_time          INTEGER NOT NULL,
  entry_price         REAL NOT NULL,
  peak_price          REAL,              -- highest price seen since entry (trailing stops)
  liquidity_usd       REAL,
  exit_time           INTEGER,           -- the 4 h hold exit
  exit_price          REAL,
  exit_reason         TEXT,              -- 'hold' | 'stale' | 'pool_switch'
  ret_pct             REAL               -- after a 3 % round trip
);

CREATE INDEX IF NOT EXISTS idx_paper_open ON paper_trades(entry_time) WHERE exit_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_paper_rule ON paper_trades(rule, entry_time);

-- Price-driven exits of the same trades: one row per trade and exit ('tp30_sl10', 'trail15', ...).
CREATE TABLE IF NOT EXISTS paper_exits (
  trade_id   INTEGER NOT NULL,
  exit       TEXT NOT NULL,
  exit_time  INTEGER NOT NULL,
  ret_pct    REAL,                       -- after a 3 % round trip
  reason     TEXT NOT NULL,              -- 'fired' | 'timeout' | 'stale' | 'pool_switch'
  PRIMARY KEY (trade_id, exit)
);
