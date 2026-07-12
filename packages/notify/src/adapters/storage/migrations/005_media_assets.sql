-- @orgname/notify — per-tenant media library (logos live on tenants directly;
-- this is for outbound message attachments: images, videos, documents, audio)
-- Run after 004_tenant_scope_existing_tables.sql

CREATE TABLE IF NOT EXISTS media_assets (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind               VARCHAR(20)  NOT NULL CHECK (kind IN ('image','video','document','audio')),
  blob_url           TEXT         NOT NULL,
  content_type       VARCHAR(100) NOT NULL,
  size_bytes         INTEGER      NOT NULL,
  original_filename  VARCHAR(255),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_created ON media_assets (tenant_id, created_at DESC);
