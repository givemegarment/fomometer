-- Signals written to Solana as memos (workers/labeler/src/record.ts).
-- signal_events.chain_sig: transaction; chain_at: when it was sent; chain_ok: NULL pending, 1 landed, 0 did not.
-- signal_outcomes.chain_sig: copied when the outcome is labeled (landed only), kept forever.
ALTER TABLE signal_events ADD COLUMN chain_sig TEXT;
ALTER TABLE signal_events ADD COLUMN chain_at INTEGER;
ALTER TABLE signal_events ADD COLUMN chain_ok INTEGER;
ALTER TABLE signal_outcomes ADD COLUMN chain_sig TEXT;
