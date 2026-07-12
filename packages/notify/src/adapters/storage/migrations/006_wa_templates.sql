-- @orgname/notify — synced copy of each tenant's Meta-approved (HSM) message
-- templates, mirrors GET /{wabaId}/message_templates. Distinct from the local
-- JS-function template registry (notify.registerTemplate()) — this table only
-- ever holds Meta's own definitions, refreshed by a "sync" action.
-- Run after 005_media_assets.sql

CREATE TABLE IF NOT EXISTS wa_templates (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meta_template_id   VARCHAR(64)  NOT NULL,
  name               VARCHAR(200) NOT NULL,
  language           VARCHAR(20)  NOT NULL,
  category           VARCHAR(30)  NOT NULL,
  status             VARCHAR(30)  NOT NULL,
  components         JSONB        NOT NULL DEFAULT '[]',
  last_synced_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, meta_template_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_tenant ON wa_templates (tenant_id);
