-- =============================================================================
-- FOMOMETER.XYZ — D1 schema
-- =============================================================================
-- Apply: wrangler d1 execute fomometer --file=./infra/d1-schema.sql
-- Idempotent: uses IF NOT EXISTS everywhere.
-- =============================================================================

-- Users (Telegram identities) -------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  tg_id          TEXT PRIMARY KEY,           -- store as text to avoid 53-bit JS overflow
  username       TEXT,
  first_name     TEXT,
  photo_url      TEXT,
  is_subscribed  INTEGER NOT NULL DEFAULT 1,
  last_check_at  INTEGER NOT NULL,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_subscribed ON users(is_subscribed);
CREATE INDEX IF NOT EXISTS idx_users_last_check ON users(last_check_at);

-- Sessions --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  jti                TEXT PRIMARY KEY,
  tg_id              TEXT NOT NULL,
  expires_at         INTEGER NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  user_agent         TEXT,
  ip_hash            TEXT,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_tg_id ON sessions(tg_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Tokens (mostly metadata) ----------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
  address       TEXT PRIMARY KEY,
  symbol        TEXT,
  name          TEXT,
  chain         TEXT NOT NULL DEFAULT 'solana',
  pair_address  TEXT,
  dex_id        TEXT,
  image_url     TEXT,
  socials_json  TEXT,
  first_seen    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_updated  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tokens_last_updated ON tokens(last_updated DESC);

-- Time-series snapshots (1-min cadence) ---------------------------------------
CREATE TABLE IF NOT EXISTS token_snapshots (
  address          TEXT NOT NULL,
  time             INTEGER NOT NULL,
  price_usd        REAL,
  price_native     REAL,
  market_cap       REAL,
  fdv              REAL,
  liquidity_usd    REAL,
  volume_m5        REAL,
  volume_h1        REAL,
  volume_h6        REAL,
  volume_h24       REAL,
  price_change_m5  REAL,
  price_change_h1  REAL,
  price_change_h6  REAL,
  price_change_h24 REAL,
  buys_h1          INTEGER,
  sells_h1         INTEGER,
  PRIMARY KEY (address, time)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_time     ON token_snapshots(time DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_addr_t   ON token_snapshots(address, time DESC);

-- Computed signals (one row per token per refresh) ----------------------------
CREATE TABLE IF NOT EXISTS signals (
  address        TEXT NOT NULL,
  time           INTEGER NOT NULL,
  score          REAL NOT NULL,
  factors_json   TEXT NOT NULL,
  is_buy         INTEGER NOT NULL DEFAULT 0,
  is_sell        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (address, time)
);

CREATE INDEX IF NOT EXISTS idx_signals_time   ON signals(time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_score  ON signals(score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_addr_t ON signals(address, time DESC);

-- Live signal events (BUY / SELL / FOMO transitions) --------------------------
CREATE TABLE IF NOT EXISTS signal_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  address        TEXT NOT NULL,
  time           INTEGER NOT NULL,
  event_type     TEXT NOT NULL,    -- 'buy_trigger' | 'sell_trigger' | 'fomo_spike'
  score          REAL NOT NULL,
  prev_score     REAL,
  metadata_json  TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_time     ON signal_events(time DESC);
CREATE INDEX IF NOT EXISTS idx_events_address  ON signal_events(address, time DESC);
CREATE INDEX IF NOT EXISTS idx_events_type     ON signal_events(event_type);

-- Signal outcomes (auto-labeled PnL after each event) -------------------------
-- One row per signal_event after enough lookahead time has passed. Filled
-- by the outcome labeler cron from token_snapshots. Used for offline
-- precision/recall/Sharpe evaluation and for refitting fallback weights.
CREATE TABLE IF NOT EXISTS signal_outcomes (
  event_id        INTEGER PRIMARY KEY,        -- fk to signal_events.id
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
  max_pnl_pct_4h  REAL,                       -- best PnL within the 4h window
  min_pnl_pct_4h  REAL,                       -- worst PnL within the 4h window
  labeled_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_outcomes_event_time ON signal_outcomes(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_event_type ON signal_outcomes(event_type);
CREATE INDEX IF NOT EXISTS idx_outcomes_address    ON signal_outcomes(address, event_time DESC);

-- User watchlist --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS watchlist (
  tg_id     TEXT NOT NULL,
  address   TEXT NOT NULL,
  added_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tg_id, address)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(tg_id);

-- Engine cursor / state (key-value) -------------------------------------------
CREATE TABLE IF NOT EXISTS engine_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Useful retention pruning helpers (manual or scheduled) ----------------------
-- DELETE FROM token_snapshots WHERE time < unixepoch() - 72*3600;
-- DELETE FROM signals WHERE time < unixepoch() - 72*3600;
-- DELETE FROM signal_events WHERE time < unixepoch() - 14*86400;
