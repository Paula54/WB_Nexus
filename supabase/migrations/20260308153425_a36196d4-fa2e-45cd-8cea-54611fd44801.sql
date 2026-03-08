
-- Create pages table for multi-page site builder
CREATE TABLE public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova Página',
  slug TEXT NOT NULL DEFAULT 'nova-pagina',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

-- Enable RLS
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own pages" ON public.pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own pages" ON public.pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pages" ON public.pages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pages" ON public.pages FOR DELETE USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update page_sections to also reference pages (optional link)
ALTER TABLE public.page_sections ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE;
