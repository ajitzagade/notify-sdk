-- @orgname/notify — tags for contact segmentation (broadcast-list targeting,
-- filtering). Additive: a defaulted array column, existing rows just get an
-- empty array, nothing about existing contact rows changes. Custom fields
-- reuse the existing contacts.attributes JSONB column — it already existed
-- for exactly this purpose, just needed a UI on top of it (see ContactsPanel).
-- Run after 016_conversations.sql

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- GIN index so "contacts with tag X" (tag filter, future segment-aware
-- broadcast targeting) doesn't scan every row for a growing contact list.
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags);
