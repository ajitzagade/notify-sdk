-- @orgname/notify — persisted inbound replies and button taps, for campaign
-- reply-rate reporting. Previously these only ever fired an event and were
-- lost. Depends on 002_tenants.sql (tenants table) already having run.
-- Run after 009_admin_audit_log.sql

CREATE TABLE IF NOT EXISTS message_replies (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wa_message_id               VARCHAR(120) NOT NULL,
  -- The outbound message this replies to — always present for button taps,
  -- only present for text replies if the user quoted a message. NULL means
  -- "can't be attributed to a specific campaign/send", not "no reply".
  in_reply_to_wa_message_id   VARCHAR(120),
  from_phone                  VARCHAR(20)  NOT NULL,
  type                        VARCHAR(20)  NOT NULL CHECK (type IN ('button', 'text')),
  button_id                   VARCHAR(200),
  button_title                VARCHAR(200),
  body                        TEXT,
  received_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_replies_tenant_received  ON message_replies (tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_replies_in_reply_to      ON message_replies (in_reply_to_wa_message_id);
