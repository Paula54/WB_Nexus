ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS facebook_page_id TEXT,
ADD COLUMN IF NOT EXISTS instagram_business_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_business_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;