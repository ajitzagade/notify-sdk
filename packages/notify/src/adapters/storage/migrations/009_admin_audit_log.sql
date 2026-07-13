-- @orgname/notify — admin action audit trail (credential/branding changes,
-- API key issuance/revocation, etc.) for accountability in a shared-ops-team
-- admin panel. Run after 008_tenant_api_keys.sql

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID         REFERENCES tenants(id) ON DELETE CASCADE,
  admin_user_id  UUID         REFERENCES admin_users(id),
  action         VARCHAR(100) NOT NULL,
  details        JSONB        NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_tenant_created ON admin_audit_log (tenant_id, created_at DESC);
