
-- Create project_credentials table
CREATE TABLE public.project_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  meta_access_token TEXT,
  meta_ads_account_id TEXT,
  facebook_page_id TEXT,
  instagram_business_id TEXT,
  whatsapp_business_id TEXT,
  whatsapp_phone_number_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.project_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own credentials"
  ON public.project_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own credentials"
  ON public.project_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
  ON public.project_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials"
  ON public.project_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_project_credentials_updated_at
  BEFORE UPDATE ON public.project_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from projects
INSERT INTO public.project_credentials (project_id, user_id, meta_access_token, meta_ads_account_id, facebook_page_id, instagram_business_id, whatsapp_business_id, whatsapp_phone_number_id)
SELECT id, user_id, meta_access_token, meta_ads_account_id, facebook_page_id, instagram_business_id, whatsapp_business_id, whatsapp_phone_number_id
FROM public.projects
WHERE meta_access_token IS NOT NULL
   OR meta_ads_account_id IS NOT NULL
   OR facebook_page_id IS NOT NULL
   OR instagram_business_id IS NOT NULL
   OR whatsapp_business_id IS NOT NULL
   OR whatsapp_phone_number_id IS NOT NULL
ON CONFLICT (project_id) DO NOTHING;
