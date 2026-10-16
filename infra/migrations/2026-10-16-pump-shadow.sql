-- Shadow tracking of pump.fun graduates (tokens that left the bonding curve for PumpSwap).
-- The labeler reads migrations from the chain (workers/labeler/src/pump.ts); the engine screens each
-- one once near the age rule and scores the survivors like the boosted universe, but writes to the
-- shadow_* tables only: nothing here reaches the site, the chain record or X.
CREATE TABLE IF NOT EXISTS pump_graduates (
  mint           TEXT PRIMARY KEY,
  sig            TEXT NOT NULL,      -- the migration transaction
  migrated_at    INTEGER NOT NULL,   -- its block time
  checked_at     INTEGER,            -- the one liquidity screen (engine)
  liquidity_usd  REAL,               -- at the screen
  active         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_grad_unchecked ON pump_graduates(migrated_at) WHERE checked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_grad_active    ON pump_graduates(migrated_at) WHERE active = 1;

-- Score per shadow token per run (the previous score for transitions). Pruned with signals.
CREATE TABLE IF NOT EXISTS shadow_signals (
  address   TEXT NOT NULL,
  time      INTEGER NOT NULL,
  score     REAL NOT NULL,
  fomo_raw  REAL,
  PRIMARY KEY (address, time)
);

CREATE INDEX IF NOT EXISTS idx_shadow_signals_time ON shadow_signals(time);

-- Events the engine would have emitted for shadow tokens, same rules as signal_events.
CREATE TABLE IF NOT EXISTS shadow_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  address        TEXT NOT NULL,
  time           INTEGER NOT NULL,
  event_type     TEXT NOT NULL,
  score          REAL NOT NULL,
  prev_score     REAL,
  metadata_json  TEXT
);

CREATE INDEX IF NOT EXISTS idx_shadow_events_time ON shadow_events(time DESC);

-- Their outcomes, priced by the labeler exactly like signal_outcomes. Kept forever.
CREATE TABLE IF NOT EXISTS shadow_outcomes (
  event_id        INTEGER PRIMARY KEY,
  address         TEXT NOT NULL,
  event_time      INTEGER NOT NULL,
  event_type      TEXT NOT NULL,
  entry_price     REAL NOT NULL,
  price_15m       REAL,
  price_1h        REAL,
  price_4h        REAL,
  pnl_pct_15m     REAL,
  pnl_pct_1h      REAL,
  pnl_pct_4h      REAL,
  max_pnl_pct_4h  REAL,
  min_pnl_pct_4h  REAL,
  labeled_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  price_flag      TEXT,
  factors_json    TEXT
);

CREATE INDEX IF NOT EXISTS idx_shadow_outcomes_time ON shadow_outcomes(event_time DESC);
