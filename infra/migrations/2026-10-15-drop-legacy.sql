-- Tables left from the Telegram-gated version. Nothing reads or writes them
-- (no bindings, no SQL in apps/, workers/, packages/). Rows on 2026-10-15:
-- users 3, sessions 0, watchlist 0. Destructive: owner's command only.
--   wrangler d1 execute fomometer --remote --file=./infra/migrations/2026-10-15-drop-legacy.sql
DROP TABLE IF EXISTS watchlist;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
