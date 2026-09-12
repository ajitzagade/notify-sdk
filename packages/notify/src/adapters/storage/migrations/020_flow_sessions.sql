-- Simple automation flows (fixed, platform-wide question sequences — see
-- apps/api/src/lib/automation/flows.ts for the definition, dispatchAutomationFlow.ts
-- for the state machine). One row per (tenant, contact): which flow they're
-- on, which step, and their answers so far. Re-triggering a flow resets this
-- row rather than creating a new one — a contact only ever has one flow
-- state at a time, matching v1's "fixed platform-wide flow" scope (no
-- per-tenant flow configuration yet, so there's nothing to disambiguate).
-- Run after 019_tenant_category_onboarding.sql

CREATE TABLE IF NOT EXISTS flow_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone         VARCHAR(20) NOT NULL,
  flow_key      VARCHAR(50) NOT NULL,
  current_step  SMALLINT NOT NULL DEFAULT 0,
  answers       JSONB NOT NULL DEFAULT '[]',
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_flow_sessions_tenant_status ON flow_sessions(tenant_id, status);
