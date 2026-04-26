-- 1) Colunas para suportar templates
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_sector TEXT,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS template_description TEXT;

-- 2) Índice para listagem rápida de modelos
CREATE INDEX IF NOT EXISTS idx_pages_is_template
  ON public.pages (is_template)
  WHERE is_template = true;

-- 3) RLS: qualquer utilizador autenticado pode ler modelos
DROP POLICY IF EXISTS "Anyone authenticated can view templates" ON public.pages;
CREATE POLICY "Anyone authenticated can view templates"
  ON public.pages
  FOR SELECT
  TO authenticated
  USING (is_template = true);