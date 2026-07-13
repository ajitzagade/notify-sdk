-- @orgname/notify — per-tenant outbound event webhooks. Lets a tenant react
-- to message.sent/delivered/read/failed/reply instead of polling /v1/logs.
-- Entirely additive: a new table, nothing existing changes.
-- Run after 013_ai_configs.sql

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url                   TEXT         NOT NULL,
  secret_ciphertext     TEXT         NOT NULL,
  secret_iv             TEXT         NOT NULL,
  secret_tag            TEXT         NOT NULL,
  key_version           INT          NOT NULL DEFAULT 1,
  -- Subset of 'sent' | 'delivered' | 'read' | 'failed' | 'reply'.
  events                TEXT[]       NOT NULL,
  is_active             BOOLEAN      NOT NULL DEFAULT true,
  consecutive_failures  INT          NOT NULL DEFAULT 0,
  disabled_at           TIMESTAMPTZ,
  created_by_admin_id   UUID         REFERENCES admin_users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant ON webhook_endpoints (tenant_id);
-- The dispatcher's hot-path query: "active endpoints for this tenant that want this event".
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant_active ON webhook_endpoints (tenant_id) WHERE is_active;
