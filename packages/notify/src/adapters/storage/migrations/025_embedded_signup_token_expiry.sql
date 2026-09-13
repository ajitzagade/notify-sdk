-- Phase 2 (Embedded Signup) follow-on: the System-user access token issued by
-- the "WhatsApp Embedded Signup Configuration With 60 Expiration Token" Meta
-- configuration expires in 60 days -- unlike the manual path's permanent
-- System User token, this one needs periodic refreshing. NULL for every
-- manual-path tenant (their token never expires, nothing to track).
--
-- Run after 024_follow_up_sequences.sql

ALTER TABLE tenant_wa_credentials ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenant_wa_credentials_token_expiry
  ON tenant_wa_credentials (access_token_expires_at)
  WHERE access_token_expires_at IS NOT NULL;
