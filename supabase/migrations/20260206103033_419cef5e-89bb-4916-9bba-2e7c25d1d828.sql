-- Create ads_campaigns table for traffic engine
CREATE TABLE public.ads_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
  daily_budget NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'completed')),
  ad_copy TEXT,
  target_audience TEXT,
  metrics JSONB DEFAULT '{"impressions": 0, "clicks": 0, "conversions": 0, "spend": 0}'::jsonb,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ads_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own campaigns" 
ON public.ads_campaigns 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns" 
ON public.ads_campaigns 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" 
ON public.ads_campaigns 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" 
ON public.ads_campaigns 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_ads_campaigns_updated_at
BEFORE UPDATE ON public.ads_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();