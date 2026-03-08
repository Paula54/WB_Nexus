
-- Add usage counters and limits to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS concierge_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS concierge_limit integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS blog_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blog_limit integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS perf_scan_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perf_scan_limit integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS whatsapp_ai_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_ai_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_at timestamp with time zone NOT NULL DEFAULT now();

-- Set correct defaults per existing plan_type
UPDATE public.subscriptions SET
  concierge_limit = CASE plan_type
    WHEN 'START' THEN 20
    WHEN 'GROWTH' THEN 100
    WHEN 'NEXUS_OS' THEN 9999
    ELSE 20 END,
  blog_limit = CASE plan_type
    WHEN 'START' THEN 1
    WHEN 'GROWTH' THEN 4
    WHEN 'NEXUS_OS' THEN 10
    ELSE 1 END,
  perf_scan_limit = CASE plan_type
    WHEN 'START' THEN 1
    WHEN 'GROWTH' THEN 2
    WHEN 'NEXUS_OS' THEN 4
    ELSE 1 END,
  whatsapp_ai_limit = CASE plan_type
    WHEN 'START' THEN 0
    WHEN 'GROWTH' THEN 100
    WHEN 'NEXUS_OS' THEN 500
    ELSE 0 END;

-- Function to auto-set limits when plan changes
CREATE OR REPLACE FUNCTION public.sync_plan_quotas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type THEN
    NEW.concierge_limit := CASE NEW.plan_type
      WHEN 'START' THEN 20
      WHEN 'GROWTH' THEN 100
      WHEN 'NEXUS_OS' THEN 9999
      ELSE 20 END;
    NEW.blog_limit := CASE NEW.plan_type
      WHEN 'START' THEN 1
      WHEN 'GROWTH' THEN 4
      WHEN 'NEXUS_OS' THEN 10
      ELSE 1 END;
    NEW.perf_scan_limit := CASE NEW.plan_type
      WHEN 'START' THEN 1
      WHEN 'GROWTH' THEN 2
      WHEN 'NEXUS_OS' THEN 4
      ELSE 1 END;
    NEW.whatsapp_ai_limit := CASE NEW.plan_type
      WHEN 'START' THEN 0
      WHEN 'GROWTH' THEN 100
      WHEN 'NEXUS_OS' THEN 500
      ELSE 0 END;
    -- Reset counters on plan change
    NEW.concierge_used := 0;
    NEW.blog_used := 0;
    NEW.perf_scan_used := 0;
    NEW.whatsapp_ai_used := 0;
    NEW.usage_reset_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_plan_quotas
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_plan_quotas();
