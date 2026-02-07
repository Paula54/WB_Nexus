
-- Table to store Google Ads OAuth connections per user
CREATE TABLE public.google_ads_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  google_email TEXT,
  google_refresh_token TEXT NOT NULL,
  google_ads_customer_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_ads_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own Google Ads accounts"
  ON public.google_ads_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Google Ads accounts"
  ON public.google_ads_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Ads accounts"
  ON public.google_ads_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google Ads accounts"
  ON public.google_ads_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_google_ads_accounts_updated_at
  BEFORE UPDATE ON public.google_ads_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
