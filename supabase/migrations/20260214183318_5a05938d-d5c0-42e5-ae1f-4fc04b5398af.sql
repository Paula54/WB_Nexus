
-- Table to store Google Analytics/Search Console OAuth connections
CREATE TABLE public.google_analytics_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  google_email TEXT,
  google_refresh_token TEXT NOT NULL,
  google_access_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  ga4_property_id TEXT,
  search_console_site_url TEXT,
  scopes TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_analytics_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own connections"
  ON public.google_analytics_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own connections"
  ON public.google_analytics_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
  ON public.google_analytics_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
  ON public.google_analytics_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_google_analytics_connections_updated_at
  BEFORE UPDATE ON public.google_analytics_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
