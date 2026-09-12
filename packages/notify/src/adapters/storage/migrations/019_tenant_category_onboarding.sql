-- Phase 1 of the Tech Provider roadmap (docs/whatsapp-platform-roadmap.md):
-- generalize onboarding beyond any single business vertical.
--
-- tenants.category — which kind of business this tenant is (healthcare, retail,
-- restaurant, services, education, other). Drives which starter templates the
-- setup flow suggests; free of any FK so new verticals are a copy change, not
-- a migration.
--
-- tenant_wa_credentials.onboarding_method — which door the tenant's WhatsApp
-- connection came through: 'manual' (ops/tenant pasted credentials from their
-- own Meta app — today's only path) or 'embedded_signup' (Phase 2: OAuth via
-- the platform's own Meta app). Both paths are permanent, not a migration flag;
-- everything downstream of credential storage is identical for both.
-- Run after 018_tenant_portal_users.sql

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS category VARCHAR(40);

ALTER TABLE tenant_wa_credentials
  ADD COLUMN IF NOT EXISTS onboarding_method VARCHAR(20) NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  ALTER TABLE tenant_wa_credentials
    ADD CONSTRAINT tenant_wa_credentials_onboarding_method_check
    CHECK (onboarding_method IN ('manual', 'embedded_signup'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
