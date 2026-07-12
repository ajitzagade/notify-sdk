-- @orgname/notify — persisted contacts, broadcast lists, and campaigns.
-- Replaces the SDK's in-memory-only BroadcastList (packages/notify/src/bulk/BulkSender.ts)
-- for admin-managed audiences that need to survive process restarts.
-- Run after 006_wa_templates.sql

CREATE TABLE IF NOT EXISTS contacts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone        VARCHAR(20)  NOT NULL,
  name         VARCHAR(200),
  attributes   JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts (tenant_id);

CREATE TABLE IF NOT EXISTS broadcast_lists (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_lists_tenant ON broadcast_lists (tenant_id);

CREATE TABLE IF NOT EXISTS broadcast_list_members (
  list_id     UUID        NOT NULL REFERENCES broadcast_lists(id) ON DELETE CASCADE,
  contact_id  UUID        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, contact_id)
);

-- One row per HSM template send-out against a broadcast list. Recipient-level
-- personalization isn't supported (matches BulkSender.send(), which applies
-- the same options to every recipient) — hsm_params are identical for everyone.
CREATE TABLE IF NOT EXISTS campaigns (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  broadcast_list_id     UUID         NOT NULL REFERENCES broadcast_lists(id),
  hsm_template_name     VARCHAR(200) NOT NULL,
  hsm_language          VARCHAR(20)  NOT NULL,
  hsm_params            JSONB        NOT NULL DEFAULT '[]',
  status                VARCHAR(20)  NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','running','completed','failed')),
  stats                 JSONB,
  created_by_admin_id   UUID         REFERENCES admin_users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns (tenant_id);
