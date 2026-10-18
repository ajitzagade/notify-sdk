-- 029: tenant portal users can now issue their own API keys from the portal
-- (self-service), so a key is attributed to whichever kind of user created it —
-- same pattern as campaigns.created_by_tenant_user_id in 018. Run after 028.

ALTER TABLE tenant_api_keys
  ADD COLUMN IF NOT EXISTS created_by_tenant_user_id UUID REFERENCES tenant_portal_users(id);
