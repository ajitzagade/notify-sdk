-- @orgname/notify — multi-tenant foundation
-- Run after 001_notify.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(200) NOT NULL,
  slug                  VARCHAR(100) NOT NULL UNIQUE,
  status                VARCHAR(20)  NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended','archived')),
  logo_blob_url         TEXT,
  primary_color         VARCHAR(7),   -- '#rrggbb'
  secondary_color       VARCHAR(7),
  business_description  TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);

CREATE TABLE IF NOT EXISTS admin_users (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT         NOT NULL,
  password_salt   TEXT         NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'ops'
                    CHECK (role IN ('super_admin','ops')),
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
