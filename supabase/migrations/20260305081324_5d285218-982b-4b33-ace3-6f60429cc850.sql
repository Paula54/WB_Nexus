
-- Landing pages table
CREATE TABLE public.landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Página Principal',
  slug TEXT NOT NULL DEFAULT 'index',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own landing pages" ON public.landing_pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own landing pages" ON public.landing_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own landing pages" ON public.landing_pages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own landing pages" ON public.landing_pages FOR DELETE USING (auth.uid() = user_id);

-- Page sections table
CREATE TABLE public.page_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own page sections" ON public.page_sections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own page sections" ON public.page_sections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own page sections" ON public.page_sections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own page sections" ON public.page_sections FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_landing_pages_updated_at BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_page_sections_updated_at BEFORE UPDATE ON public.page_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
