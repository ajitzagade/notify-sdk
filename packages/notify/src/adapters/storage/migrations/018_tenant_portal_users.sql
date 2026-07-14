-- @orgname/notify — tenant-facing portal logins. A fully separate identity
-- system from admin_users: a portal user belongs to exactly one tenant and
-- can only ever act within it. Accounts are created by ops from the admin
-- console (no self-serve signup), same governance pattern as admin_users
-- and tenant_api_keys. Run after 017_contacts_tags.sql

CREATE TABLE IF NOT EXISTS tenant_portal_users (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  password_hash         TEXT         NOT NULL,
  password_salt         TEXT         NOT NULL,
  is_active             BOOLEAN      NOT NULL DEFAULT true,
  last_login_at         TIMESTAMPTZ,
  created_by_admin_id   UUID         REFERENCES admin_users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_portal_users_tenant ON tenant_portal_users (tenant_id);

-- Additive: lets a campaign record a tenant portal user as its creator.
-- created_by_admin_id is untouched — exactly one of the two is ever set.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_by_tenant_user_id UUID REFERENCES tenant_portal_users(id);
