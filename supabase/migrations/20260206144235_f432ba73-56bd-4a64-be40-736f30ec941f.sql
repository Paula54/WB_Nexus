-- Add domain column to projects table for SEO audit lockdown
ALTER TABLE public.projects ADD COLUMN domain text;

-- Add index for quick domain lookups
CREATE INDEX idx_projects_domain ON public.projects (domain) WHERE domain IS NOT NULL;