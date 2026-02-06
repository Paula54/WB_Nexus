
-- Add Meta Ads credential columns to projects table
ALTER TABLE public.projects 
ADD COLUMN meta_ads_account_id TEXT,
ADD COLUMN meta_access_token TEXT;

-- Add a comment to indicate these are sensitive fields
COMMENT ON COLUMN public.projects.meta_access_token IS 'Meta Ads API access token - protected by RLS';
COMMENT ON COLUMN public.projects.meta_ads_account_id IS 'Meta Ads account ID for campaign management';
