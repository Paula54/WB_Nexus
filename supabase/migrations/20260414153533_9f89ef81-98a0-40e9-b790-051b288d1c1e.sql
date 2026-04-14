ALTER TABLE public.project_credentials
ADD COLUMN IF NOT EXISTS meta_client_id text DEFAULT NULL;