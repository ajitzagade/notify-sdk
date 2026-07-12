-- @orgname/notify — per-tenant WhatsApp Cloud API credentials (encrypted at rest)
-- Run after 002_tenants.sql

CREATE TABLE IF NOT EXISTS tenant_wa_credentials (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id         VARCHAR(64)  NOT NULL,
  waba_id                 VARCHAR(64),
  access_token_ciphertext TEXT         NOT NULL,
  access_token_iv         VARCHAR(32)  NOT NULL,
  access_token_tag        VARCHAR(32)  NOT NULL,
  app_secret_ciphertext   TEXT,
  app_secret_iv           VARCHAR(32),
  app_secret_tag          VARCHAR(32),
  verify_token            VARCHAR(200) NOT NULL,
  key_version             SMALLINT     NOT NULL DEFAULT 1,
  last_verified_at        TIMESTAMPTZ,
  last_verified_status    VARCHAR(20)  CHECK (last_verified_status IN ('ok','failed')),
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id),
  UNIQUE (phone_number_id)
);

-- webhook multi-tenant routing resolves tenant by phone_number_id, so this lookup
-- needs to be fast — the UNIQUE constraint above already creates a backing index.
