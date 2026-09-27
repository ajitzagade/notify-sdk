-- Interactive list-message replies (a tap on a slot-picker row) are a
-- distinct reply type from button taps — see WebhookHandler.parseReply's
-- 'list_reply' branch and TemplateEngine's 'interactive_list' send support.
-- Widens the existing CHECK constraint (previously 'button' | 'text' only)
-- and adds the two columns list replies populate. Additive: existing rows
-- are all 'button'/'text' and are unaffected; the new columns are nullable.

ALTER TABLE message_replies DROP CONSTRAINT IF EXISTS message_replies_type_check;
ALTER TABLE message_replies ADD CONSTRAINT message_replies_type_check
  CHECK (type IN ('button', 'text', 'list'));

ALTER TABLE message_replies ADD COLUMN IF NOT EXISTS list_row_id    VARCHAR(200);
ALTER TABLE message_replies ADD COLUMN IF NOT EXISTS list_row_title VARCHAR(200);
