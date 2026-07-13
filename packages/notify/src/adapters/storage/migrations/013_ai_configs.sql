-- @orgname/notify — per-tenant AI reply assistant configuration (BYO OpenAI/
-- Anthropic key, encrypted the same way as WhatsApp credentials) plus the
-- per-(tenant,phone) auto-reply state needed to cap replies and hand off to
-- a human. Entirely additive: a new table, and new DEFAULTed columns on the
-- existing notify_preferences row (already the one row per tenant+phone,
-- reused here as the "thread state" holder rather than introducing a
-- conversations table before Phase 3 needs one).
-- Run after 012_campaigns_header_media.sql

CREATE TABLE IF NOT EXISTS ai_configs (
  id                               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                        UUID         NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  provider                         VARCHAR(20)  NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  model                            VARCHAR(100) NOT NULL,
  api_key_ciphertext               TEXT,
  api_key_iv                       TEXT,
  api_key_tag                      TEXT,
  key_version                     INT          NOT NULL DEFAULT 1,
  system_prompt                    TEXT,
  auto_reply_enabled               BOOLEAN      NOT NULL DEFAULT false,
  auto_reply_max_per_conversation  INT          NOT NULL DEFAULT 3,
  created_at                       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_configs_tenant ON ai_configs (tenant_id);

-- Per-thread (tenant_id, phone) auto-reply state. All three columns are
-- additive with safe defaults — every existing notify_preferences row keeps
-- working exactly as before; only rows the AI bot actually replies to ever
-- get non-default values here.
ALTER TABLE notify_preferences ADD COLUMN IF NOT EXISTS ai_reply_count INT NOT NULL DEFAULT 0;
ALTER TABLE notify_preferences ADD COLUMN IF NOT EXISTS ai_autoreply_disabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notify_preferences ADD COLUMN IF NOT EXISTS ai_handoff_summary TEXT;

-- Atomically claims one auto-reply "slot" for a (tenant, phone) thread —
-- creates the notify_preferences row on first contact if it doesn't exist
-- yet (a brand-new inbound number has no row until now), otherwise
-- increments the counter only if the thread isn't disabled and hasn't hit
-- its cap. Single statement, so concurrent inbound messages for the same
-- phone (e.g. a customer double-texting) can never both claim past the cap
-- — exactly the race BulkSender-style concurrent webhook delivery would
-- otherwise create.
CREATE OR REPLACE FUNCTION claim_ai_reply_slot(
  p_tenant_id UUID,
  p_phone VARCHAR,
  p_max_replies INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_claimed BOOLEAN;
BEGIN
  INSERT INTO notify_preferences (tenant_id, phone, ai_reply_count)
  VALUES (p_tenant_id, p_phone, 1)
  ON CONFLICT (tenant_id, phone) DO UPDATE
    SET ai_reply_count = notify_preferences.ai_reply_count + 1
    WHERE NOT notify_preferences.ai_autoreply_disabled
      AND notify_preferences.ai_reply_count < p_max_replies
  RETURNING TRUE INTO v_claimed;

  RETURN COALESCE(v_claimed, FALSE);
END;
$$ LANGUAGE plpgsql;
