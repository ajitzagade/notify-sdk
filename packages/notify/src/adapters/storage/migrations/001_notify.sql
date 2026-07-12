-- @orgname/notify — PostgreSQL migration
-- Run once before using PostgresAdapter

CREATE TABLE IF NOT EXISTS notify_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone        VARCHAR(20) NOT NULL,
  template        VARCHAR(100) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','sent','delivered','read','failed')),
  wa_message_id   VARCHAR(120),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  error_message   TEXT,
  tags            JSONB        DEFAULT '[]',
  meta            JSONB        DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notify_log_wa_message_id ON notify_log (wa_message_id);
CREATE INDEX IF NOT EXISTS idx_notify_log_to_phone      ON notify_log (to_phone);
CREATE INDEX IF NOT EXISTS idx_notify_log_status        ON notify_log (status);
CREATE INDEX IF NOT EXISTS idx_notify_log_created_at    ON notify_log (created_at DESC);

CREATE TABLE IF NOT EXISTS notify_preferences (
  phone               VARCHAR(20)  PRIMARY KEY,
  opted_in            BOOLEAN      NOT NULL DEFAULT false,
  muted_until         TIMESTAMPTZ,
  timezone            VARCHAR(60)  DEFAULT 'Asia/Kolkata',
  quiet_hours_start   SMALLINT,    -- 0-23
  quiet_hours_end     SMALLINT,    -- 0-23
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
