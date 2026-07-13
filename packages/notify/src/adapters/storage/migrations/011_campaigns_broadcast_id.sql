-- @orgname/notify — a queryable column for the broadcastId BulkSender tags
-- onto every notify_log row it creates (in the meta jsonb). Without this,
-- correlating "which notify_log rows belong to this campaign" means reaching
-- into meta->>'broadcastId' on every query. Only set on successful runs —
-- a campaign that failed before sendBulk() returned has no broadcastId.
-- Run after 010_message_replies.sql

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS broadcast_id UUID;

CREATE INDEX IF NOT EXISTS idx_campaigns_broadcast_id ON campaigns (broadcast_id);
