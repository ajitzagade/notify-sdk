-- @orgname/notify — one row per (tenant, phone) thread, backing the shared
-- inbox. UNIQUE(tenant_id, contact_phone) from day one — wacrm (the project
-- this feature was scoped against) hit a real production bug where
-- concurrent inbound webhooks forked one contact into two conversations
-- before they added this same constraint after the fact; we start with it.
-- Run after 015_notify_log_body_preview.sql

CREATE TABLE IF NOT EXISTS conversations (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_phone      VARCHAR(20)  NOT NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  assigned_admin_id  UUID         REFERENCES admin_users(id),
  has_unread         BOOLEAN      NOT NULL DEFAULT true,
  last_message_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_last_message ON conversations (tenant_id, last_message_at DESC);

-- Backfill: one conversation per distinct phone that has ever replied,
-- so the inbox isn't empty for tenants who already have reply history.
-- has_unread = false on backfilled rows — these are pre-existing threads,
-- not new ones nobody has seen yet; marking the whole history "unread" the
-- moment this feature ships would be noisy and not true to reality.
INSERT INTO conversations (tenant_id, contact_phone, last_message_at, has_unread)
SELECT tenant_id, from_phone, MAX(received_at), false
FROM message_replies
GROUP BY tenant_id, from_phone
ON CONFLICT (tenant_id, contact_phone) DO NOTHING;
