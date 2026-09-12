-- Conversation assignment existed only for internal ops staff
-- (assigned_admin_id) -- a client's own team (tenant_portal_users) had no
-- way to distribute their own inbox among themselves at all. This adds the
-- parallel column; automatic round-robin assignment (see
-- apps/api/src/lib/conversations.ts) only applies to this one, since ops
-- staff aren't tenant-scoped the way portal users are -- there's no well-
-- defined "which admins handle this tenant" pool to round-robin over.
-- Run after 021_canned_responses.sql

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_portal_user_id UUID
  REFERENCES tenant_portal_users(id);

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_portal_user
  ON conversations (assigned_portal_user_id) WHERE assigned_portal_user_id IS NOT NULL;
