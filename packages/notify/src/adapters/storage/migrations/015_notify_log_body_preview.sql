-- @orgname/notify — notify_log never stored the actual content of a sent
-- message, only the template name. Foundational for the shared inbox
-- (migration 016): its thread view needs to show real outbound content,
-- not "[text message sent]". Additive, nullable — existing rows are simply
-- NULL here, existing callers of logEvent() that don't pass bodyPreview
-- are unaffected.
-- Run after 014_webhook_endpoints.sql

ALTER TABLE notify_log ADD COLUMN IF NOT EXISTS body_preview TEXT;
