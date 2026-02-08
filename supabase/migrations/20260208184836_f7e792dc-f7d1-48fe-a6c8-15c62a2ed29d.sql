-- Add mcc_customer_id column for Manager account hierarchy
ALTER TABLE public.google_ads_accounts 
ADD COLUMN mcc_customer_id text DEFAULT NULL;

COMMENT ON COLUMN public.google_ads_accounts.mcc_customer_id IS 'Manager (MCC) account ID used as login-customer-id header for Google Ads API calls';