
CREATE TABLE public.performance_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scanned_by UUID NOT NULL,
  performance_score INTEGER NOT NULL DEFAULT 0,
  accessibility_score INTEGER NOT NULL DEFAULT 0,
  best_practices_score INTEGER NOT NULL DEFAULT 0,
  seo_score INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  scan_type TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_scans ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all scans"
  ON public.performance_scans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Freelancers can insert and view scans for tasks assigned to them
CREATE POLICY "Freelancers can insert scans for assigned projects"
  ON public.performance_scans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.project_id = performance_scans.project_id
        AND tasks.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Freelancers can view scans for assigned projects"
  ON public.performance_scans FOR SELECT
  TO authenticated
  USING (
    scanned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.project_id = performance_scans.project_id
        AND tasks.assigned_to = auth.uid()
    )
  );

-- Project owners can view scans
CREATE POLICY "Project owners can view scans"
  ON public.performance_scans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = performance_scans.project_id
        AND projects.user_id = auth.uid()
    )
  );
