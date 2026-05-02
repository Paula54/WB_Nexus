alter table "public"."projects" add column "brand_fonts" jsonb not null default '{"body": "Inter", "heading": "Inter"}'::jsonb;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, contact_email)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$function$
;

CREATE OR REPLACE FUNCTION public.spend_credits(p_action text, p_cost integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_total integer; v_used integer;
BEGIN
  SELECT total_credits, used_credits INTO v_total, v_used
  FROM nx_usage_credits WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF (v_used + p_cost) > v_total THEN RETURN false; END IF;
  UPDATE nx_usage_credits SET used_credits = used_credits + p_cost, updated_at = now()
  WHERE user_id = auth.uid();
  RETURN true;
END $function$
;

CREATE OR REPLACE FUNCTION public.sync_plan_quotas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type THEN
    NEW.concierge_limit := CASE NEW.plan_type WHEN 'START' THEN 20 WHEN 'GROWTH' THEN 100 WHEN 'NEXUS_OS' THEN 9999 ELSE 20 END;
    NEW.blog_limit      := CASE NEW.plan_type WHEN 'START' THEN 1  WHEN 'GROWTH' THEN 4   WHEN 'NEXUS_OS' THEN 10   ELSE 1  END;
    NEW.perf_scan_limit := CASE NEW.plan_type WHEN 'START' THEN 1  WHEN 'GROWTH' THEN 2   WHEN 'NEXUS_OS' THEN 4    ELSE 1  END;
    NEW.whatsapp_ai_limit := CASE NEW.plan_type WHEN 'START' THEN 0 WHEN 'GROWTH' THEN 100 WHEN 'NEXUS_OS' THEN 500 ELSE 0 END;
    NEW.concierge_used := 0; NEW.blog_used := 0; NEW.perf_scan_used := 0; NEW.whatsapp_ai_used := 0;
    NEW.usage_reset_at := now();
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END $function$
;

CREATE TRIGGER send_whatsapp_reply AFTER INSERT ON realtime.messages_2026_04_05 FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://google.pt', 'POST', '{"Content-type":"application/json"}', '{}', '5000');


