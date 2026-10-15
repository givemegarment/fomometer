-- Roadmap phase 2, data integrity. Additive only; apply once, before deploying the
-- engine and labeler that write these columns:
--   wrangler d1 execute fomometer --remote --file=./infra/migrations/2026-10-15-data-integrity.sql

-- Raw volume-burst factor per signal row, so the burst threshold is a percentile of
-- the same raw value it is compared with (was a percentile of normalized values).
ALTER TABLE signals ADD COLUMN fomo_raw REAL;

-- Factor vectors copied from the event ({"scored": {...}, "raw": {...}}); outcomes are
-- never pruned, so training can use all history.
ALTER TABLE signal_outcomes ADD COLUMN factors_json TEXT;

-- 'rise_over_1000pct' when the best price in the 4 h window is more than 11x entry:
-- on DexScreener this is a switch to a different pool, not a tradable move.
ALTER TABLE signal_outcomes ADD COLUMN price_flag TEXT;
UPDATE signal_outcomes SET price_flag = 'rise_over_1000pct' WHERE max_pnl_pct_4h > 1000;

-- Baseline: every scored token sampled every 30 minutes, priced like an event
-- (filled by the labeler). The "pick at random from the same list" comparison
-- for the track record; kept forever like signal_outcomes.
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
