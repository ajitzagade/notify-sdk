-- Generalizes the fixed, platform-wide "book" flow (migration 020) into a
-- per-tenant configurable one. Ops builds a tenant's flow from the admin
-- console (v1 scope: no portal-side editor, no branching — each flow is
-- still a fixed linear script, just tenant-specific instead of hardcoded).
-- Run after 022_conversation_portal_assignment.sql

CREATE TABLE IF NOT EXISTS flow_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_keyword     VARCHAR(50) NOT NULL,
  -- Array of {question: string, options?: string[]} — options present means
  -- a WhatsApp quick-reply-button step (max 3, Meta's own limit), absent
  -- means free text. See apps/api/src/lib/automation/dispatchAutomationFlow.ts.
  steps               JSONB NOT NULL,
  completion_message  TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, trigger_keyword)
);

CREATE INDEX IF NOT EXISTS idx_flow_definitions_tenant_active ON flow_definitions(tenant_id) WHERE is_active;

-- flow_sessions now points at a specific tenant-owned definition instead of
-- a hardcoded key — nullable since the column is added after the table
-- (no existing rows to backfill meaningfully; any in-flight session from
-- before this migration was against the old hardcoded flow and will simply
-- appear as having no definition, which the dispatcher treats as "unknown,
-- fail open" same as any other missing-reference case).
ALTER TABLE flow_sessions ADD COLUMN IF NOT EXISTS flow_definition_id UUID
  REFERENCES flow_definitions(id) ON DELETE CASCADE;
