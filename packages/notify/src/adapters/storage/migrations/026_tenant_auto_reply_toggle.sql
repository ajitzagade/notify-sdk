-- Per-tenant kill switch for AI auto-reply + keyword automation flows.
-- Both features are already self-gating (automation needs an active
-- flow_definitions keyword match; AI needs an ai_configs row), so a tenant
-- with neither configured is already silent. This flag is belt-and-braces
-- against future accidental configuration — e.g. a clinic tenant (Cliniqly
-- integration) that answers every patient message itself and must never
-- get a double reply from this platform's own automation.
-- DEFAULT TRUE preserves every existing tenant's current behavior exactly.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN NOT NULL DEFAULT TRUE;
