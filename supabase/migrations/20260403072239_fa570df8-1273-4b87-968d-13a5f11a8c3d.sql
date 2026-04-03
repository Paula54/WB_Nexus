ALTER TABLE public.meta_connections ADD COLUMN IF NOT EXISTS page_access_token text DEFAULT NULL;
ALTER TABLE public.meta_connections ADD COLUMN IF NOT EXISTS facebook_page_id text DEFAULT NULL;