


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'freelancer',
    'customer'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_project_credentials"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.project_credentials (
        project_id, 
        provider, 
        client_id, 
        client_secret,
        meta_client_id
    )
    VALUES (
        NEW.id,
        'meta',
        '1578338553386945',
        'c9aca98cd45507dbfe8706e4f1a8c389',
        '1578338553386945'
    )
    ON CONFLICT (project_id, provider) 
    DO UPDATE SET 
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        meta_client_id = EXCLUDED.meta_client_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_project_credentials"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, contact_email)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_credits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.nx_usage_credits (user_id, total_credits, plan_name)
  VALUES (new.id, 100, 'Start');
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_credits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_project"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.projects (user_id, name)
  VALUES (new.id, 'O Meu Projeto Nexus');
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_project"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."handle_new_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_invoices_to_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.invoices
  SET user_id = NEW.id
  WHERE user_id IS NULL
    AND customer_email IS NOT NULL
    AND lower(customer_email) = lower(NEW.contact_email);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_invoices_to_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."spend_credits"("p_action" "text", "p_cost" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_total integer; v_used integer;
BEGIN
  SELECT total_credits, used_credits INTO v_total, v_used
  FROM nx_usage_credits WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF (v_used + p_cost) > v_total THEN RETURN false; END IF;
  UPDATE nx_usage_credits SET used_credits = used_credits + p_cost, updated_at = now()
  WHERE user_id = auth.uid();
  RETURN true;
END $$;


ALTER FUNCTION "public"."spend_credits"("p_action" "text", "p_cost" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_asset_names"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.name := NEW.file_name;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_asset_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_asset_urls"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.url IS NULL THEN
    NEW.url := NEW.public_url;
  END IF;
  IF NEW.public_url IS NULL THEN
    NEW.public_url := NEW.url;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_asset_urls"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_plan_quotas"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
END $$;


ALTER FUNCTION "public"."sync_plan_quotas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "private"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "action" "text",
    "is_security_log" boolean DEFAULT false
);


ALTER TABLE "private"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ads_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "platform" "text" NOT NULL,
    "daily_budget" numeric DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'paused'::"text" NOT NULL,
    "ad_copy" "text",
    "target_audience" "text",
    "metrics" "jsonb" DEFAULT '{"spend": 0, "clicks": 0, "conversions": 0, "impressions": 0}'::"jsonb",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ads_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "mime_type" "text",
    "file_size" integer,
    "public_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "excerpt" "text",
    "image_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "legal_name" "text",
    "trade_name" "text",
    "nif" "text",
    "address_line1" "text",
    "address_line2" "text",
    "postal_code" "text",
    "city" "text",
    "country" "text" DEFAULT 'Portugal'::"text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "logo_url" "text",
    "facebook_url" "text",
    "instagram_url" "text",
    "linkedin_url" "text",
    "complaints_book_url" "text",
    "dre_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "page_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "content" "text",
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "validated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."compliance_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concierge_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."concierge_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concierge_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "concierge_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."concierge_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "whatsapp" "text",
    "assunto" "text",
    "mensagem" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "message_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversation_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cookie_consent_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "enabled" boolean DEFAULT true NOT NULL,
    "banner_text" "text" DEFAULT 'Este website utiliza cookies para melhorar a sua experiência. Ao continuar a navegar, concorda com a nossa política de cookies.'::"text",
    "accept_button_text" "text" DEFAULT 'Aceitar'::"text",
    "reject_button_text" "text" DEFAULT 'Rejeitar'::"text",
    "settings_button_text" "text" DEFAULT 'Configurações'::"text",
    "background_color" "text" DEFAULT '#1a1a2e'::"text",
    "text_color" "text" DEFAULT '#ffffff'::"text",
    "button_color" "text" DEFAULT '#6366f1'::"text",
    "position" "text" DEFAULT 'bottom'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cookie_consent_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."domain_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "domain_name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "purchase_price" numeric NOT NULL,
    "cost_price" numeric NOT NULL,
    "expiry_date" timestamp with time zone,
    "nameservers" "text"[],
    "porkbun_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."domain_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "content" "text" NOT NULL,
    "from_name" "text" DEFAULT 'Nexus Machine'::"text",
    "from_email" "text" DEFAULT 'newsletter@mail.web-business.pt'::"text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "sent_count" integer DEFAULT 0,
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_ads_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "google_email" "text",
    "google_refresh_token" "text" NOT NULL,
    "google_ads_customer_id" "text",
    "mcc_customer_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."google_ads_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_analytics_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "google_email" "text",
    "google_refresh_token" "text" NOT NULL,
    "google_access_token" "text",
    "token_expires_at" timestamp with time zone,
    "ga4_property_id" "text",
    "search_console_site_url" "text",
    "scopes" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."google_analytics_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "amount_total" integer NOT NULL,
    "currency" "text" DEFAULT 'eur'::"text",
    "status" "text" NOT NULL,
    "invoice_pdf" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "customer_email" "text",
    "stripe_invoice_id" "text",
    "created" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Página Principal'::"text" NOT NULL,
    "slug" "text" DEFAULT 'index'::"text" NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."landing_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "company" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "status" "text" DEFAULT 'novo'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text",
    "notes" "text",
    "reminder_date" timestamp with time zone,
    "value" numeric,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "whatsapp_message" "text",
    "ai_classification" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads_diagnostico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "ref_agente_id" "uuid",
    "nome_negocio" "text",
    "email" "text",
    "telefone" "text",
    "desafio_principal" "text",
    "publico_alvo" "text",
    "investimento" "text",
    "plano_recomendado" "text",
    "completo" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "site_url" "text",
    "whatsapp" "text",
    "challenge" "text",
    "monthly_investment" "text",
    "business_name" "text"
);


ALTER TABLE "public"."leads_diagnostico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "text",
    "plan_selected" "text" DEFAULT 'START'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."legal_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_contents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "language" "text" DEFAULT '''pt'''::"text" NOT NULL
);


ALTER TABLE "public"."legal_contents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."legal_contents"."language" IS 'PT';



CREATE TABLE IF NOT EXISTS "public"."meta_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "connection_type" "text" DEFAULT 'imported'::"text" NOT NULL,
    "ad_account_id" "text",
    "facebook_page_id" "text",
    "page_access_token" "text",
    "instagram_business_id" "text",
    "whatsapp_account_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meta_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'note'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "due_date" timestamp with time zone,
    "is_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notes_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nx_company_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "legal_name" "text" NOT NULL,
    "brand_name" "text" DEFAULT 'WB Nexus'::"text",
    "tax_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "address" "text",
    "zip_code" "text",
    "city" "text",
    "phone" "text"
);


ALTER TABLE "public"."nx_company_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nx_usage_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "total_credits" integer DEFAULT 100 NOT NULL,
    "used_credits" integer DEFAULT 0 NOT NULL,
    "plan_name" "text" DEFAULT 'Start'::"text" NOT NULL,
    "last_reset" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."nx_usage_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "landing_page_id" "uuid" NOT NULL,
    "page_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."page_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Nova Página'::"text" NOT NULL,
    "slug" "text" DEFAULT 'nova-pagina'::"text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_template" boolean DEFAULT false NOT NULL,
    "template_sector" "text",
    "template_name" "text",
    "template_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_scans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "scanned_by" "uuid" NOT NULL,
    "performance_score" integer DEFAULT 0 NOT NULL,
    "accessibility_score" integer DEFAULT 0 NOT NULL,
    "best_practices_score" integer DEFAULT 0 NOT NULL,
    "seo_score" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "scan_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."performance_scans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prices" (
    "id" "text" NOT NULL,
    "product_id" "text",
    "active" boolean,
    "unit_amount" bigint,
    "currency" "text",
    "type" "text",
    "interval" "text",
    "interval_count" integer,
    "metadata" "jsonb"
);


ALTER TABLE "public"."prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "text" NOT NULL,
    "active" boolean,
    "name" "text",
    "description" "text",
    "image" "text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "company_name" "text",
    "contact_email" "text",
    "business_sector" "text",
    "ai_custom_instructions" "text",
    "ai_credits_limit" integer DEFAULT 50000 NOT NULL,
    "ai_credits_used" integer DEFAULT 0 NOT NULL,
    "ai_images_limit" integer DEFAULT 100 NOT NULL,
    "ai_images_used" integer DEFAULT 0 NOT NULL,
    "email_sends_limit" integer DEFAULT 500 NOT NULL,
    "email_sends_used" integer DEFAULT 0 NOT NULL,
    "whatsapp_usage_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "meta_client_id" "text",
    "meta_access_token" "text",
    "meta_ads_account_id" "text",
    "facebook_page_id" "text",
    "instagram_business_id" "text",
    "whatsapp_business_id" "text",
    "whatsapp_phone_number_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "project_type" "text" DEFAULT 'marketing'::"text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "description" "text",
    "domain" "text",
    "selected_plan" "text",
    "trial_expires_at" timestamp with time zone,
    "business_name" "text",
    "legal_name" "text",
    "trade_name" "text",
    "nif" "text",
    "business_sector" "text",
    "address_line1" "text",
    "address_line2" "text",
    "postal_code" "text",
    "city" "text",
    "country" "text" DEFAULT 'Portugal'::"text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "logo_url" "text",
    "facebook_url" "text",
    "instagram_url" "text",
    "linkedin_url" "text",
    "facebook_page_id" "text",
    "instagram_business_id" "text",
    "whatsapp_business_id" "text",
    "whatsapp_phone_number_id" "text",
    "meta_access_token" "text",
    "meta_ads_account_id" "text",
    "google_analytics_id" "text",
    "measurement_id" "text",
    "gtm_container_id" "text",
    "complaints_book_url" "text",
    "dre_url" "text",
    "freelancer_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "brand_colors" "jsonb" DEFAULT '{"accent": "#f59e0b", "primary": "#667eea", "secondary": "#764ba2"}'::"jsonb" NOT NULL,
    "brand_fonts" "jsonb" DEFAULT '{"body": "Inter", "heading": "Inter"}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "caption" "text" NOT NULL,
    "hashtags" "text"[] DEFAULT '{}'::"text"[],
    "image_url" "text",
    "scheduled_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "webhook_url" "text",
    "webhook_response" "jsonb",
    "published_at" timestamp with time zone,
    "error_log" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."social_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "plan_type" "text" DEFAULT 'START'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "concierge_used" integer DEFAULT 0 NOT NULL,
    "concierge_limit" integer DEFAULT 20 NOT NULL,
    "blog_used" integer DEFAULT 0 NOT NULL,
    "blog_limit" integer DEFAULT 1 NOT NULL,
    "perf_scan_used" integer DEFAULT 0 NOT NULL,
    "perf_scan_limit" integer DEFAULT 1 NOT NULL,
    "whatsapp_ai_used" integer DEFAULT 0 NOT NULL,
    "whatsapp_ai_limit" integer DEFAULT 0 NOT NULL,
    "usage_reset_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "assigned_by" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "freelancer_notes" "text",
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "bucket_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'customer'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "briefing" "text" NOT NULL,
    "project_type" "text" DEFAULT 'marketing'::"text" NOT NULL,
    "category" "text" DEFAULT 'Personalizado'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "reference_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "twilio_phone_number" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_accounts" OWNER TO "postgres";


ALTER TABLE ONLY "private"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ads_campaigns"
    ADD CONSTRAINT "ads_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_profiles"
    ADD CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_profiles"
    ADD CONSTRAINT "business_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."compliance_pages"
    ADD CONSTRAINT "compliance_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_pages"
    ADD CONSTRAINT "compliance_pages_project_id_page_type_key" UNIQUE ("project_id", "page_type");



ALTER TABLE ONLY "public"."compliance_pages"
    ADD CONSTRAINT "compliance_pages_user_id_page_type_key" UNIQUE ("user_id", "page_type");



ALTER TABLE ONLY "public"."concierge_conversations"
    ADD CONSTRAINT "concierge_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concierge_messages"
    ADD CONSTRAINT "concierge_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_requests"
    ADD CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cookie_consent_settings"
    ADD CONSTRAINT "cookie_consent_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cookie_consent_settings"
    ADD CONSTRAINT "cookie_consent_settings_project_id_key" UNIQUE ("project_id");



ALTER TABLE ONLY "public"."domain_registrations"
    ADD CONSTRAINT "domain_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_ads_accounts"
    ADD CONSTRAINT "google_ads_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_analytics_connections"
    ADD CONSTRAINT "google_analytics_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_stripe_invoice_id_key" UNIQUE ("stripe_invoice_id");



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_project_id_slug_key" UNIQUE ("project_id", "slug");



ALTER TABLE ONLY "public"."leads_diagnostico"
    ADD CONSTRAINT "leads_diagnostico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_consents"
    ADD CONSTRAINT "legal_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_contents"
    ADD CONSTRAINT "legal_contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_connections"
    ADD CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes_reminders"
    ADD CONSTRAINT "notes_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nx_company_profiles"
    ADD CONSTRAINT "nx_company_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nx_company_profiles"
    ADD CONSTRAINT "nx_company_profiles_tax_id_key" UNIQUE ("tax_id");



ALTER TABLE ONLY "public"."nx_usage_credits"
    ADD CONSTRAINT "nx_usage_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nx_usage_credits"
    ADD CONSTRAINT "nx_usage_credits_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."page_sections"
    ADD CONSTRAINT "page_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_project_id_slug_key" UNIQUE ("project_id", "slug");



ALTER TABLE ONLY "public"."performance_scans"
    ADD CONSTRAINT "performance_scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."project_credentials"
    ADD CONSTRAINT "project_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_credentials"
    ADD CONSTRAINT "project_credentials_project_id_key" UNIQUE ("project_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_posts"
    ADD CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscribers"
    ADD CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscribers"
    ADD CONSTRAINT "subscribers_user_id_email_key" UNIQUE ("user_id", "email");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_contents"
    ADD CONSTRAINT "unique_slug_language" UNIQUE ("slug", "language");



ALTER TABLE ONLY "public"."user_assets"
    ADD CONSTRAINT "user_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."user_templates"
    ADD CONSTRAINT "user_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_accounts"
    ADD CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_accounts"
    ADD CONSTRAINT "whatsapp_accounts_twilio_phone_number_key" UNIQUE ("twilio_phone_number");



CREATE INDEX "idx_conv_msgs_lead" ON "public"."conversation_messages" USING "btree" ("lead_id");



CREATE INDEX "idx_landing_pages_project" ON "public"."landing_pages" USING "btree" ("project_id");



CREATE INDEX "idx_leads_user" ON "public"."leads" USING "btree" ("user_id");



CREATE INDEX "idx_page_sections_landing" ON "public"."page_sections" USING "btree" ("landing_page_id");



CREATE INDEX "idx_page_sections_page" ON "public"."page_sections" USING "btree" ("page_id");



CREATE INDEX "idx_pages_project" ON "public"."pages" USING "btree" ("project_id");



CREATE INDEX "idx_projects_user" ON "public"."projects" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_sync_plan_quotas" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_plan_quotas"();



CREATE OR REPLACE TRIGGER "update_ads_campaigns_updated_at" BEFORE UPDATE ON "public"."ads_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_blog_posts_updated_at" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_business_profiles_updated_at" BEFORE UPDATE ON "public"."business_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compliance_pages_updated_at" BEFORE UPDATE ON "public"."compliance_pages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_concierge_conversations_updated_at" BEFORE UPDATE ON "public"."concierge_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cookie_consent_settings_updated_at" BEFORE UPDATE ON "public"."cookie_consent_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_domain_registrations_updated_at" BEFORE UPDATE ON "public"."domain_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_campaigns_updated_at" BEFORE UPDATE ON "public"."email_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_google_ads_accounts_updated_at" BEFORE UPDATE ON "public"."google_ads_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_google_analytics_connections_updated_at" BEFORE UPDATE ON "public"."google_analytics_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_landing_pages_updated_at" BEFORE UPDATE ON "public"."landing_pages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_diagnostico_updated_at" BEFORE UPDATE ON "public"."leads_diagnostico" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_meta_connections_updated_at" BEFORE UPDATE ON "public"."meta_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notes_reminders_updated_at" BEFORE UPDATE ON "public"."notes_reminders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_page_sections_updated_at" BEFORE UPDATE ON "public"."page_sections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pages_updated_at" BEFORE UPDATE ON "public"."pages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_credentials_updated_at" BEFORE UPDATE ON "public"."project_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_social_posts_updated_at" BEFORE UPDATE ON "public"."social_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_templates_updated_at" BEFORE UPDATE ON "public"."user_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_whatsapp_accounts_updated_at" BEFORE UPDATE ON "public"."whatsapp_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nx_company_profiles"
    ADD CONSTRAINT "nx_company_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."user_assets"
    ADD CONSTRAINT "user_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "private"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Agents can view referred diagnostic leads" ON "public"."leads_diagnostico" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "ref_agente_id"));



CREATE POLICY "Allow public read" ON "public"."prices" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Allow public read access" ON "public"."prices" FOR SELECT USING (true);



CREATE POLICY "Allow public read access" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Anon can insert unclaimed leads" ON "public"."leads_diagnostico" FOR INSERT TO "anon" WITH CHECK (("user_id" IS NULL));



CREATE POLICY "Anyone can insert concierge messages" ON "public"."concierge_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert contact messages" ON "public"."contact_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can subscribe to newsletter" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Auth users can insert own leads" ON "public"."leads_diagnostico" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can update own diagnostic leads" ON "public"."leads_diagnostico" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Permitir leitura para todos" ON "public"."legal_contents" FOR SELECT USING (true);



CREATE POLICY "Public prices access" ON "public"."prices" FOR SELECT USING (true);



CREATE POLICY "Public products access" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Service Role Full Access Invoices" ON "public"."invoices" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can insert their own company profile" ON "public"."nx_company_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage assets" ON "public"."user_assets" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own company profile" ON "public"."nx_company_profiles" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own diagnostic leads" ON "public"."leads_diagnostico" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own invoices" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ads_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_admin_all" ON "public"."blog_posts" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "blog_author_all" ON "public"."blog_posts" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_published_public" ON "public"."blog_posts" FOR SELECT TO "authenticated" USING (("status" = 'published'::"text"));



ALTER TABLE "public"."business_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concierge_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concierge_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consent_insert_own" ON "public"."legal_consents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "consent_select_own" ON "public"."legal_consents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "contact_admin_view" ON "public"."contact_requests" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "contact_insert_anyone" ON "public"."contact_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cookie_consent_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credits_select_own" ON "public"."nx_usage_credits" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."domain_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_ads_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_analytics_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."landing_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_diagnostico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_contents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta_connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_delete" ON "public"."conversation_messages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "conversation_messages"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "msg_insert" ON "public"."conversation_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "conversation_messages"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "msg_select" ON "public"."conversation_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "conversation_messages"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nx_company_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nx_usage_credits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_delete" ON "public"."ads_campaigns" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."assets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."business_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."compliance_pages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."concierge_conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."cookie_consent_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."domain_registrations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."email_campaigns" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."google_ads_accounts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."google_analytics_connections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."landing_pages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."leads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."meta_connections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."notes_reminders" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."page_sections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."pages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."project_credentials" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."projects" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."social_posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."subscribers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."user_templates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_delete" ON "public"."whatsapp_accounts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."ads_campaigns" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."assets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."business_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."compliance_pages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."concierge_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."cookie_consent_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."domain_registrations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."email_campaigns" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."google_ads_accounts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."google_analytics_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."landing_pages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."leads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."meta_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."notes_reminders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."page_sections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."pages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."project_credentials" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."projects" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."social_posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."subscribers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."user_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_insert" ON "public"."whatsapp_accounts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."ads_campaigns" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."assets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."business_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."compliance_pages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."concierge_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."cookie_consent_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."domain_registrations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."email_campaigns" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."google_ads_accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."google_analytics_connections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."landing_pages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."leads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."meta_connections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."notes_reminders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."page_sections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."pages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."project_credentials" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."projects" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."social_posts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."subscribers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."user_templates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_select" ON "public"."whatsapp_accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."ads_campaigns" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."business_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."compliance_pages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."concierge_conversations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."cookie_consent_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."domain_registrations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."email_campaigns" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."google_ads_accounts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."google_analytics_connections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."landing_pages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."leads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."meta_connections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."notes_reminders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."page_sections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."pages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."project_credentials" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."projects" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."social_posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."subscribers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."user_templates" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_update" ON "public"."whatsapp_accounts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."page_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pages_templates_public" ON "public"."pages" FOR SELECT TO "authenticated" USING (("is_template" = true));



CREATE POLICY "perf_admin_all" ON "public"."performance_scans" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "perf_freelancer_insert" ON "public"."performance_scans" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tasks"
  WHERE (("tasks"."project_id" = "performance_scans"."project_id") AND ("tasks"."assigned_to" = "auth"."uid"())))));



CREATE POLICY "perf_freelancer_select" ON "public"."performance_scans" FOR SELECT TO "authenticated" USING ((("scanned_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."tasks"
  WHERE (("tasks"."project_id" = "performance_scans"."project_id") AND ("tasks"."assigned_to" = "auth"."uid"()))))));



CREATE POLICY "perf_owner_select" ON "public"."performance_scans" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "performance_scans"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."performance_scans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_admin_all" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "roles_self_select" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."social_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subs_select_own" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_admin_delete" ON "public"."tasks" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "tasks_admin_insert" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "tasks_freelancer_select" ON "public"."tasks" FOR SELECT TO "authenticated" USING ((("assigned_to" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "tasks_freelancer_update" ON "public"."tasks" FOR UPDATE TO "authenticated" USING ((("assigned_to" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



ALTER TABLE "public"."user_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_select_own" ON "public"."wallet_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_accounts" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "private" TO "service_role";
GRANT USAGE ON SCHEMA "private" TO "anon";
GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_project_credentials"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_project_credentials"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_project_credentials"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_project"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_project"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_project"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_invoices_to_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_invoices_to_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_invoices_to_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."spend_credits"("p_action" "text", "p_cost" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."spend_credits"("p_action" "text", "p_cost" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."spend_credits"("p_action" "text", "p_cost" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_asset_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_asset_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_asset_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_asset_urls"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_asset_urls"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_asset_urls"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_plan_quotas"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_plan_quotas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_plan_quotas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "private"."audit_logs" TO "service_role";
GRANT ALL ON TABLE "private"."audit_logs" TO "authenticated";



GRANT ALL ON TABLE "public"."ads_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."ads_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."ads_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."business_profiles" TO "anon";
GRANT ALL ON TABLE "public"."business_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."business_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_pages" TO "anon";
GRANT ALL ON TABLE "public"."compliance_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_pages" TO "service_role";



GRANT ALL ON TABLE "public"."concierge_conversations" TO "anon";
GRANT ALL ON TABLE "public"."concierge_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."concierge_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."concierge_messages" TO "anon";
GRANT ALL ON TABLE "public"."concierge_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."concierge_messages" TO "service_role";



GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";



GRANT ALL ON TABLE "public"."contact_requests" TO "anon";
GRANT ALL ON TABLE "public"."contact_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_requests" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_messages" TO "anon";
GRANT ALL ON TABLE "public"."conversation_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_messages" TO "service_role";



GRANT ALL ON TABLE "public"."cookie_consent_settings" TO "anon";
GRANT ALL ON TABLE "public"."cookie_consent_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."cookie_consent_settings" TO "service_role";



GRANT ALL ON TABLE "public"."domain_registrations" TO "anon";
GRANT ALL ON TABLE "public"."domain_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."domain_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."email_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."email_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."email_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."google_ads_accounts" TO "anon";
GRANT ALL ON TABLE "public"."google_ads_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."google_ads_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."google_analytics_connections" TO "anon";
GRANT ALL ON TABLE "public"."google_analytics_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."google_analytics_connections" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."landing_pages" TO "anon";
GRANT ALL ON TABLE "public"."landing_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_pages" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."leads_diagnostico" TO "anon";
GRANT ALL ON TABLE "public"."leads_diagnostico" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_diagnostico" TO "service_role";



GRANT ALL ON TABLE "public"."legal_consents" TO "anon";
GRANT ALL ON TABLE "public"."legal_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_consents" TO "service_role";



GRANT ALL ON TABLE "public"."legal_contents" TO "anon";
GRANT ALL ON TABLE "public"."legal_contents" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_contents" TO "service_role";



GRANT ALL ON TABLE "public"."meta_connections" TO "anon";
GRANT ALL ON TABLE "public"."meta_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."meta_connections" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."notes_reminders" TO "anon";
GRANT ALL ON TABLE "public"."notes_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."notes_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."nx_company_profiles" TO "anon";
GRANT ALL ON TABLE "public"."nx_company_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."nx_company_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."nx_usage_credits" TO "anon";
GRANT ALL ON TABLE "public"."nx_usage_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."nx_usage_credits" TO "service_role";



GRANT ALL ON TABLE "public"."page_sections" TO "anon";
GRANT ALL ON TABLE "public"."page_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."page_sections" TO "service_role";



GRANT ALL ON TABLE "public"."pages" TO "anon";
GRANT ALL ON TABLE "public"."pages" TO "authenticated";
GRANT ALL ON TABLE "public"."pages" TO "service_role";



GRANT ALL ON TABLE "public"."performance_scans" TO "anon";
GRANT ALL ON TABLE "public"."performance_scans" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_scans" TO "service_role";



GRANT ALL ON TABLE "public"."prices" TO "anon";
GRANT ALL ON TABLE "public"."prices" TO "authenticated";
GRANT ALL ON TABLE "public"."prices" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_credentials" TO "anon";
GRANT ALL ON TABLE "public"."project_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."project_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."social_posts" TO "anon";
GRANT ALL ON TABLE "public"."social_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."social_posts" TO "service_role";



GRANT ALL ON TABLE "public"."subscribers" TO "anon";
GRANT ALL ON TABLE "public"."subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_assets" TO "anon";
GRANT ALL ON TABLE "public"."user_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_assets" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_templates" TO "anon";
GRANT ALL ON TABLE "public"."user_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."user_templates" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_accounts" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_accounts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop policy "contact_insert_anyone" on "public"."contact_requests";


  create policy "contact_insert_anyone"
  on "public"."contact_requests"
  as permissive
  for insert
  to anon, authenticated
with check (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE TRIGGER send_whatsapp_reply AFTER INSERT ON realtime.messages_2026_04_05 FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://google.pt', 'POST', '{"Content-type":"application/json"}', '{}', '5000');


  create policy "Enable insert for authenticated users only"
  on "storage"."buckets"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Auth Delete Documents"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Auth Insert Documents"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Auth Insert Others"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'others'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Auth Insert Products"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'products'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Auth Select Documents"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Auth Update Documents"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Owner Read Documents"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Permitir visualização pública de logos"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'logos'::text));



  create policy "Public Read Others"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'others'::text));



  create policy "Public Read Products"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'products'::text));



  create policy "Public read access for social images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'social-images'::text));



  create policy "Users can delete their own social images"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'social-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can update their own social images"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'social-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload social images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'social-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users manage own logos"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
with check (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "site-images authenticated insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'site-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "site-images owner delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'site-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "site-images owner update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'site-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "site-images public read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'site-images'::text));



