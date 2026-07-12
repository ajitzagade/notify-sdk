-- @orgname/notify — API keys for tenant-facing programmatic sends (POST /v1/send).
-- Keys are issued by ops in the admin panel (no self-serve signup), formatted
-- as nsk_<8-char prefix><24-char secret>; only the prefix is stored in the
-- clear (for lookup + display), the full key is hashed like a password.
-- Run after 007_contacts_lists_campaigns.sql

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_prefix            VARCHAR(16)  NOT NULL,
  key_hash              TEXT         NOT NULL,
  key_salt              TEXT         NOT NULL,
  label                 VARCHAR(200),
  created_by_admin_id   UUID         REFERENCES admin_users(id),
  last_used_at          TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant  ON tenant_api_keys (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_prefix  ON tenant_api_keys (key_prefix);
