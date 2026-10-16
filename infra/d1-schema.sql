-- =============================================================================
-- FOMOMETER.XYZ — D1 schema
-- =============================================================================
-- Apply: wrangler d1 execute fomometer --file=./infra/d1-schema.sql
-- Idempotent: uses IF NOT EXISTS everywhere.
-- =============================================================================

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
  fomo_raw       REAL,                       -- raw volume-burst factor (threshold percentile source)
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
  metadata_json  TEXT,             -- {regime, threshold, factors: {scored, raw}}
  chain_sig      TEXT,             -- Solana memo transaction (labeler, record.ts)
  chain_at       INTEGER,          -- when it was sent
  chain_ok       INTEGER           -- NULL pending, 1 landed, 0 did not land
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
  labeled_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  price_flag      TEXT,                       -- 'rise_over_1000pct': suspect pool switch
  factors_json    TEXT,                       -- {scored, raw} copied from the event
  chain_sig       TEXT                        -- the event's landed memo transaction, if any
);

CREATE INDEX IF NOT EXISTS idx_outcomes_event_time ON signal_outcomes(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_event_type ON signal_outcomes(event_type);
CREATE INDEX IF NOT EXISTS idx_outcomes_address    ON signal_outcomes(address, event_time DESC);

-- Baseline (every scored token every 30 min, priced like an event) -----------
-- Filled by the labeler; the comparison for the track record. Kept forever.
CREATE TABLE IF NOT EXISTS baseline_outcomes (
  address       TEXT NOT NULL,
  sample_time   INTEGER NOT NULL,
  entry_price   REAL NOT NULL,
  price_15m     REAL,
  price_1h      REAL,
  price_4h      REAL,
  max_price_4h  REAL,
  PRIMARY KEY (address, sample_time)
);

CREATE INDEX IF NOT EXISTS idx_baseline_time ON baseline_outcomes(sample_time);

-- Swaps that paid the FOMOMETER referral fee -----------------------------------
-- Filled by the labeler from the chain: every transaction that raised the balance
-- of a token account owned by the Jupiter referral account. Kept forever.
CREATE TABLE IF NOT EXISTS swaps (
  signature        TEXT PRIMARY KEY,
  block_time       INTEGER NOT NULL,
  wallet           TEXT NOT NULL,     -- fee payer and signer
  side             TEXT NOT NULL,     -- 'buy' (token in) | 'sell' (token out)
  mint             TEXT NOT NULL,     -- the traded token
  token_amount     TEXT NOT NULL,     -- raw integer, token's smallest unit
  fee_mint         TEXT NOT NULL,
  fee_ui           REAL NOT NULL,     -- fee received, in fee_mint units
  notional_ui      REAL NOT NULL,     -- fee_ui / fee rate: swap size in fee_mint units
  signal_event_id  INTEGER,           -- latest BUY on this token within an hour before a buy
  signal_time      INTEGER,
  recorded_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_swaps_time ON swaps(block_time DESC);
CREATE INDEX IF NOT EXISTS idx_swaps_mint ON swaps(mint, block_time DESC);

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

-- Posts to X ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS x_posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  ref        TEXT NOT NULL,
  mode       TEXT NOT NULL,
  status     TEXT NOT NULL,
  text       TEXT NOT NULL,
  card       TEXT NOT NULL,
  reply_to   TEXT,
  tweet_id   TEXT,
  attempts   INTEGER NOT NULL DEFAULT 0,
  error      TEXT,
  posted_at  INTEGER,
  UNIQUE (kind, ref, mode)
);
CREATE INDEX IF NOT EXISTS idx_x_posts_time ON x_posts(mode, posted_at);

-- Visits from ?ref= links ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ref_visits (
  day  TEXT NOT NULL,     -- UTC date, YYYY-MM-DD
  src  TEXT NOT NULL,     -- 'x'
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, src)
);

-- pump.fun graduates, shadow tracking (engine src/shadow.ts, labeler src/pump.ts) ---------------
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

-- Paper portfolios (engine src/paper.ts) -----------------------------------------------------------
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
