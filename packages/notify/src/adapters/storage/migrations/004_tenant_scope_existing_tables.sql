-- @orgname/notify — scope existing single-tenant tables to tenants
-- Run after 003_tenant_wa_credentials.sql
--
-- Any pre-existing rows (from single-tenant deployments) are backfilled onto a
-- seeded 'legacy' tenant so this migration is safe to run against a database
-- that already has notify_log / notify_preferences data. tenant_id also gets a
-- DEFAULT of that same legacy tenant so that a `new PostgresAdapter(pool)` call
-- with no tenantId (existing single-tenant callers) keeps working unchanged —
-- rows just land in the legacy bucket instead of a real tenant.

INSERT INTO tenants (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000000', 'Legacy / Unassigned', 'legacy', 'archived')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE notify_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE notify_log SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE notify_log ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE notify_log ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notify_log_tenant_created ON notify_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notify_log_tenant_to_phone ON notify_log (tenant_id, to_phone);

-- notify_preferences' PK today is `phone` alone — broken for multi-tenant, since the
-- same phone number can be a customer of two different tenants with independent
-- consent/quiet-hours state. Replace with a composite (tenant_id, phone) PK.
ALTER TABLE notify_preferences ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE notify_preferences SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE notify_preferences ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE notify_preferences ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE notify_preferences DROP CONSTRAINT IF EXISTS notify_preferences_pkey;
ALTER TABLE notify_preferences ADD PRIMARY KEY (tenant_id, phone);
