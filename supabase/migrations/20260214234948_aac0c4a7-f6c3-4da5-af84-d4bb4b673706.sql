
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS measurement_id text,
ADD COLUMN IF NOT EXISTS gtm_container_id text;
