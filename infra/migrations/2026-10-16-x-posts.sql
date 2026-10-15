-- Posts to the FOMOMETER account on X (workers/labeler/src/social.ts).
-- kind: signal | outcome | daily | weekly; ref: event id or UTC date; mode: dry | live.
-- status: posted | dry | retry | failed. One row per kind, ref and mode.
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
