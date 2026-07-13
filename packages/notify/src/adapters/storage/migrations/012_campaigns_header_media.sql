-- @orgname/notify — optional header media (image/video/document) for campaigns
-- whose approved template has a media HEADER component. Meta requires that
-- header's parameter to be supplied at send time; without this column there
-- was no way to run a campaign against an image/video/document-header template
-- at all — see HsmParameter's 'image' | 'video' | 'document' variants.
-- Run after 011_campaigns_broadcast_id.sql

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_media_type VARCHAR(20)
  CHECK (header_media_type IN ('image', 'video', 'document'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_media_url TEXT;
