
-- Create meta_connections table
CREATE TABLE public.meta_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ad_account_id TEXT,
  connection_type TEXT NOT NULL DEFAULT 'imported' CHECK (connection_type IN ('imported', 'created_by_nexus')),
  instagram_business_id TEXT,
  whatsapp_account_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own meta connections"
  ON public.meta_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meta connections"
  ON public.meta_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meta connections"
  ON public.meta_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meta connections"
  ON public.meta_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_meta_connections_updated_at
  BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
