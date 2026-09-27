-- Server-to-server auth for a partner platform (e.g. Cliniqly) provisioning
-- clinics programmatically via /partner/* routes in apps/api. Deliberately
-- separate from tenant_api_keys (008) — a partner key can create tenants
-- and is platform-scoped, not tied to one tenant_id, so it must never be
-- confusable with (or accepted in place of) a tenant's own nsk_ key.
-- Same scrypt-hash-at-rest + prefix-lookup-then-verify pattern as
-- tenant_api_keys, via the same hashPassword/verifyPassword primitive.

CREATE TABLE IF NOT EXISTS partner_api_keys (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix    VARCHAR(16)  NOT NULL,
  key_hash      TEXT         NOT NULL,
  key_salt      TEXT         NOT NULL,
  label         VARCHAR(200),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_api_keys_prefix ON partner_api_keys (key_prefix);
