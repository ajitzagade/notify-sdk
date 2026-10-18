-- 031: same per-request session revalidation migration 030 gave portal users,
-- now for admins — the higher-privilege surface (credentials, key minting,
-- bulk sends for every tenant). Admin tokens are stateless with a 7-day TTL;
-- without this, deactivating an admin couldn't end their live session.
-- NOTE: applying this logs out all currently-signed-in admins once (existing
-- tokens have iat < the column default NOW()) — intended. Run after 030.

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
