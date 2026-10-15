-- Daily count of visits arriving through ?ref= links in FOMOMETER's own posts (apps/web/app/api/ref).
-- No visitor data: one number per day and source.
CREATE TABLE IF NOT EXISTS ref_visits (
  day  TEXT NOT NULL,     -- UTC date, YYYY-MM-DD
  src  TEXT NOT NULL,     -- 'x'
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, src)
);
