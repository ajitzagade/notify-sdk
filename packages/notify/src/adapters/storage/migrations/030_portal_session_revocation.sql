-- 030: portal session tokens are stateless (AES-GCM, 7-day TTL), so deactivation
-- and password reset previously couldn't end a live session. Portal auth now
-- revalidates against this table per request: a token is only honored if the
-- user is still active AND the token was issued after the last password change.
-- Run after 029.

ALTER TABLE tenant_portal_users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
