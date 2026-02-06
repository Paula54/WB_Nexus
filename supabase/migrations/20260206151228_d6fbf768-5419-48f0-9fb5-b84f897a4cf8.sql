
-- Add plan and trial columns to projects table
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS selected_plan text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamp with time zone DEFAULT NULL;

-- Add index for trial expiry lookups
CREATE INDEX IF NOT EXISTS idx_projects_trial_expires ON public.projects (trial_expires_at) WHERE trial_expires_at IS NOT NULL;
