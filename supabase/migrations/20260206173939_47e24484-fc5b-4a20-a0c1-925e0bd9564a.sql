-- Add Google Analytics tracking ID column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS google_analytics_id text DEFAULT NULL;