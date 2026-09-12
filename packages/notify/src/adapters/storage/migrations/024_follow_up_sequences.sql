-- Task #6 of the competitor-gap plan: auto follow-up sequences.
--
-- Deliberately one follow-up step per campaign (UNIQUE(campaign_id)), not a
-- multi-step drip chain — matches the "keep it linear" scoping the WhatsApp
-- Forms flow builder used. A follow-up is always another Meta-approved HSM
-- template (never a session message): by the time delay_days has elapsed,
-- the original send is long outside Meta's 24h customer-service window.
--
-- Checked once a day by a Vercel Cron job (Hobby plan caps cron frequency at
-- once/day) — so delay_days is a "at least this many days" floor, not a
-- precise deadline; a recipient eligible at hour 1 of the day may not get
-- their follow-up until the day's cron run.

CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id       UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  delay_days        SMALLINT     NOT NULL CHECK (delay_days BETWEEN 1 AND 30),
  hsm_template_name VARCHAR(200) NOT NULL,
  hsm_language      VARCHAR(10)  NOT NULL,
  hsm_params        JSONB        NOT NULL DEFAULT '[]',
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  last_run_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_tenant_active
  ON follow_up_sequences (tenant_id) WHERE is_active;

-- Idempotency ledger: one row per (sequence, phone) the moment a follow-up
-- send is attempted (success or failure) — the cron runs daily, so without
-- this a still-eligible recipient would get re-sent the follow-up every day.
CREATE TABLE IF NOT EXISTS follow_up_sends (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_sequence_id  UUID        NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  phone                  VARCHAR(20) NOT NULL,
  sent_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follow_up_sequence_id, phone)
);
