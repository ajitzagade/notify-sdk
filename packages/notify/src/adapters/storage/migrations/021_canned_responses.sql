-- Canned responses — pre-written snippets an agent (ops or portal user)
-- quick-inserts into the Inbox reply composer instead of retyping common
-- answers. Deliberately just a flat per-tenant list, no categories/folders
-- in v1 — nothing about the UX needs it yet, and it's easy to add a
-- `category` column later without touching existing rows.
-- Run after 020_flow_sessions.sql

CREATE TABLE IF NOT EXISTS canned_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_tenant ON canned_responses(tenant_id);
