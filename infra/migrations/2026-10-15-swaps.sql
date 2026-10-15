-- Swaps and treasury (roadmap phase 3). Additive only; apply once, before deploying
-- the labeler that fills it:
--   wrangler d1 execute fomometer --remote --file=./infra/migrations/2026-10-15-swaps.sql

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
