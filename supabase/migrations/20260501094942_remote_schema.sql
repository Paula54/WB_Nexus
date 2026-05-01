


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
    'agente',
    'user'
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
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;


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


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
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
  IF NEW.plan_name IS DISTINCT FROM OLD.plan_name THEN
    NEW.concierge_limit := CASE WHEN upper(NEW.plan_name) = 'START' THEN 20 WHEN upper(NEW.plan_name) = 'GROWTH' THEN 100 WHEN upper(NEW.plan_name) = 'NEXUS OS' THEN 9999 ELSE 20 END;
    NEW.blog_limit := CASE WHEN upper(NEW.plan_name) = 'START' THEN 1 WHEN upper(NEW.plan_name) = 'GROWTH' THEN 4 WHEN upper(NEW.plan_name) = 'NEXUS OS' THEN 10 ELSE 1 END;
    NEW.perf_scan_limit := CASE WHEN upper(NEW.plan_name) = 'START' THEN 1 WHEN upper(NEW.plan_name) = 'GROWTH' THEN 2 WHEN upper(NEW.plan_name) = 'NEXUS OS' THEN 4 ELSE 1 END;
    NEW.whatsapp_ai_limit := CASE WHEN upper(NEW.plan_name) = 'START' THEN 0 WHEN upper(NEW.plan_name) = 'GROWTH' THEN 100 WHEN upper(NEW.plan_name) = 'NEXUS OS' THEN 500 ELSE 0 END;
    NEW.concierge_used := 0; NEW.blog_used := 0; NEW.perf_scan_used := 0; NEW.whatsapp_ai_used := 0;
    NEW.usage_reset_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_plan_quotas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ads_campaigns_platform_check" CHECK (("platform" = ANY (ARRAY['meta'::"text", 'google'::"text"]))),
    CONSTRAINT "ads_campaigns_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."ads_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text",
    "url" "text",
    "type" "text",
    "bucket_id" "text",
    "size" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "file_name" "text",
    "file_type" "text",
    "file_path" "text",
    "public_url" "text",
    "file_size" bigint,
    "last_modified" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "mime_type" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "alt_text" "text",
    "caption" "text",
    "storage_bucket" "text" DEFAULT 'assets'::"text"
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "type" "text" NOT NULL,
    "content" "text",
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."compliance_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concierge_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" NOT NULL,
    "user_id" "uuid",
    "page_url" "text",
    "user_agent" "text",
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


CREATE TABLE IF NOT EXISTS "public"."email_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "from_email" "text" DEFAULT 'newsletter@mail.web-business.pt'::"text",
    "from_name" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "sent_count" integer DEFAULT 0,
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_campaigns" OWNER TO "postgres";


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
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."landing_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "whatsapp" "text",
    "challenge" "text",
    "monthly_investment" "text",
    "business_name" "text"
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
    "user_id" "uuid",
    "ip_address" "text",
    "plan_selected" "text",
    "terms_version" "text" DEFAULT '1.0'::"text",
    "accepted_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "legal_consents_plan_selected_check" CHECK (("plan_selected" = ANY (ARRAY['Start'::"text", 'Growth'::"text", 'Nexus OS'::"text"])))
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
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "ad_account_id" "text",
    "connection_type" "text",
    "instagram_business_id" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "access_token" "text",
    "facebook_page_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "meta_user_id" "text",
    "whatsapp_account_id" "text",
    "page_access_token" "text",
    "facebook_page_name" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "user_id" "uuid" NOT NULL,
    CONSTRAINT "meta_connections_connection_type_check" CHECK (("connection_type" = ANY (ARRAY['imported'::"text", 'created_by_nexus'::"text"])))
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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notes_reminders_type_check" CHECK (("type" = ANY (ARRAY['note'::"text", 'reminder'::"text"])))
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
    "total_credits" integer DEFAULT 0,
    "used_credits" integer DEFAULT 0,
    "plan_name" "text" DEFAULT 'Start'::"text",
    "last_reset" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nx_usage_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "landing_page_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "page_id" "uuid"
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
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "performance_score" integer,
    "accessibility_score" integer,
    "seo_score" integer,
    "best_practices_score" integer,
    "report_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "performance_scans_accessibility_score_check" CHECK ((("accessibility_score" >= 0) AND ("accessibility_score" <= 100))),
    CONSTRAINT "performance_scans_best_practices_score_check" CHECK ((("best_practices_score" >= 0) AND ("best_practices_score" <= 100))),
    CONSTRAINT "performance_scans_performance_score_check" CHECK ((("performance_score" >= 0) AND ("performance_score" <= 100))),
    CONSTRAINT "performance_scans_seo_score_check" CHECK ((("seo_score" >= 0) AND ("seo_score" <= 100)))
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
    "email" "text",
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "whatsapp" "text",
    "challenge" "text",
    "monthly_investment" "text",
    "business_name" "text",
    "lead_id" "text",
    "business_sector" "text",
    "contact_email" "text",
    "company_name" "text",
    "user_id" "uuid",
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "meta_access_token" "text",
    "meta_ads_account_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "provider" "text" DEFAULT 'meta'::"text",
    "client_id" "text",
    "client_secret" "text",
    "meta_client_id" "text",
    "facebook_page_id" "text",
    "instagram_business_account_id" "text",
    "page_access_token" "text",
    "instagram_business_id" "text",
    "whatsapp_business_account_id" "text"
);


ALTER TABLE "public"."project_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "agente_id" "uuid",
    "plan_type" "text",
    "legal_data" "jsonb" DEFAULT '{}'::"jsonb",
    "domain" "text",
    "stripe_session_id" "text",
    "tracking_ids" "jsonb" DEFAULT '{}'::"jsonb",
    "performance_score" integer DEFAULT 0,
    "facebook_page_id" "text",
    "instagram_business_id" "text",
    "whatsapp_business_id" "text",
    "meta_ads_account_id" "text",
    "facebook_business_id" "text",
    "whatsapp_phone_number_id" "text",
    "google_ads_id" "text",
    "ga4_property_id" "text",
    "project_type" "text",
    "google_analytics_id" "text",
    "updated_at" "text" DEFAULT "now"(),
    "search_console_url" "text",
    "selected_plan" "text",
    "trial_expires_at" timestamp with time zone,
    "legal_name" "text",
    "trade_name" "text",
    "nif" "text",
    "address_line1" "text",
    "postal_code" "text",
    "city" "text",
    "country" "text" DEFAULT 'Portugal'::"text",
    "phone" "text",
    "website" "text",
    "logo_url" "text",
    "business_sector" "text",
    "description" "text",
    "business_name" "text",
    "address_line2" "text",
    "email" "text",
    "facebook_url" "text",
    "instagram_url" "text",
    "linkedin_url" "text",
    "complaints_book_url" "text",
    "dre_url" "text"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."google_ads_id" IS '8664492509';



CREATE TABLE IF NOT EXISTS "public"."social_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "content" "text",
    "caption" "text",
    "image_url" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "platform" "text",
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "error_log" "text",
    "webhook_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."social_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "plan_type" "text" DEFAULT 'free'::"text",
    "status" "text" DEFAULT 'inactive'::"text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "plan_name" "text",
    "contact_email" "text"
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


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
    "role" "public"."app_role" DEFAULT 'user'::"public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "private"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ads_campaigns"
    ADD CONSTRAINT "ads_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_pages"
    ADD CONSTRAINT "compliance_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_pages"
    ADD CONSTRAINT "compliance_pages_project_id_type_key" UNIQUE ("project_id", "type");



ALTER TABLE ONLY "public"."concierge_conversations"
    ADD CONSTRAINT "concierge_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concierge_messages"
    ADD CONSTRAINT "concierge_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_stripe_invoice_id_key" UNIQUE ("stripe_invoice_id");



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads_diagnostico"
    ADD CONSTRAINT "leads_diagnostico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_consents"
    ADD CONSTRAINT "legal_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_contents"
    ADD CONSTRAINT "legal_contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_connections"
    ADD CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_connections"
    ADD CONSTRAINT "meta_connections_project_id_key" UNIQUE ("project_id");



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



ALTER TABLE ONLY "public"."performance_scans"
    ADD CONSTRAINT "performance_scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_platform_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."project_credentials"
    ADD CONSTRAINT "project_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_credentials"
    ADD CONSTRAINT "project_credentials_project_id_provider_key" UNIQUE ("project_id", "provider");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_posts"
    ADD CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscribers"
    ADD CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscribers"
    ADD CONSTRAINT "subscribers_user_email_unique" UNIQUE ("user_id", "email");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."legal_contents"
    ADD CONSTRAINT "unique_slug_language" UNIQUE ("slug", "language");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "unique_user_id" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_assets"
    ADD CONSTRAINT "user_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_email_campaigns_user_id" ON "public"."email_campaigns" USING "btree" ("user_id");



CREATE INDEX "idx_projects_agente_id" ON "public"."projects" USING "btree" ("agente_id");



CREATE INDEX "idx_subscribers_tags" ON "public"."subscribers" USING "gin" ("tags");



CREATE INDEX "idx_subscribers_user_id" ON "public"."subscribers" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "on_project_created_setup_meta" AFTER INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_project_credentials"();



CREATE OR REPLACE TRIGGER "tr_sync_asset_names" BEFORE INSERT OR UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."sync_asset_names"();



CREATE OR REPLACE TRIGGER "tr_sync_asset_urls" BEFORE INSERT OR UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."sync_asset_urls"();



CREATE OR REPLACE TRIGGER "update_ads_campaigns_updated_at" BEFORE UPDATE ON "public"."ads_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_concierge_conversations_updated_at" BEFORE UPDATE ON "public"."concierge_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_diagnostico_updated_at" BEFORE UPDATE ON "public"."leads_diagnostico" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notes_reminders_updated_at" BEFORE UPDATE ON "public"."notes_reminders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ads_campaigns"
    ADD CONSTRAINT "ads_campaigns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_pages"
    ADD CONSTRAINT "compliance_pages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concierge_messages"
    ADD CONSTRAINT "concierge_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."concierge_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."legal_consents"
    ADD CONSTRAINT "legal_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meta_connections"
    ADD CONSTRAINT "meta_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nx_company_profiles"
    ADD CONSTRAINT "nx_company_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nx_usage_credits"
    ADD CONSTRAINT "nx_usage_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_sections"
    ADD CONSTRAINT "page_sections_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_sections"
    ADD CONSTRAINT "page_sections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_sections"
    ADD CONSTRAINT "page_sections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."performance_scans"
    ADD CONSTRAINT "performance_scans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_credentials"
    ADD CONSTRAINT "project_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_posts"
    ADD CONSTRAINT "social_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_assets"
    ADD CONSTRAINT "user_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "private"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admins can manage all roles" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all concierge conversations" ON "public"."concierge_conversations" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all concierge messages" ON "public"."concierge_messages" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all contact messages" ON "public"."contact_messages" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all diagnostic leads" ON "public"."leads_diagnostico" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all leads" ON "public"."leads" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view subscribers" ON "public"."newsletter_subscribers" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Agents can view referred diagnostic leads" ON "public"."leads_diagnostico" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "ref_agente_id"));



CREATE POLICY "Agents can view their referred projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "agente_id"));



CREATE POLICY "Allow public read" ON "public"."prices" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Allow public read access" ON "public"."prices" FOR SELECT USING (true);



CREATE POLICY "Allow public read access" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Anon can insert unclaimed leads" ON "public"."leads_diagnostico" FOR INSERT TO "anon" WITH CHECK (("user_id" IS NULL));



CREATE POLICY "Anyone authenticated can view templates" ON "public"."pages" FOR SELECT TO "authenticated" USING (("is_template" = true));



CREATE POLICY "Anyone can insert concierge conversations" ON "public"."concierge_conversations" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert concierge messages" ON "public"."concierge_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert contact messages" ON "public"."contact_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can subscribe to newsletter" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Auth users can insert own leads" ON "public"."leads_diagnostico" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can update own diagnostic leads" ON "public"."leads_diagnostico" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Permitir leads do Site" ON "public"."leads" FOR INSERT WITH CHECK (true);



CREATE POLICY "Permitir leitura do próprio perfil" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Permitir leitura para todos" ON "public"."legal_contents" FOR SELECT USING (true);



CREATE POLICY "Public prices access" ON "public"."prices" FOR SELECT USING (true);



CREATE POLICY "Public products access" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Service Role Full Access" ON "public"."project_credentials" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service Role Full Access Invoices" ON "public"."invoices" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service Role Full Access Profiles" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service Role Full Access Subs" ON "public"."subscriptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages meta connections" ON "public"."meta_connections" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create their own campaigns" ON "public"."ads_campaigns" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own notes and reminders" ON "public"."notes_reminders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own email campaigns" ON "public"."email_campaigns" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own meta connections" ON "public"."meta_connections" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "meta_connections"."project_id") AND ("projects"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own subscribers" ON "public"."subscribers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own assets" ON "public"."assets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own campaigns" ON "public"."ads_campaigns" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notes and reminders" ON "public"."notes_reminders" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own email campaigns" ON "public"."email_campaigns" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own subscribers" ON "public"."subscribers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own company profile" ON "public"."nx_company_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own consent" ON "public"."legal_consents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own projects" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage assets" ON "public"."user_assets" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own credentials" ON "public"."project_credentials" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own projects" ON "public"."projects" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own assets" ON "public"."assets" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own company profile" ON "public"."nx_company_profiles" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own landing pages" ON "public"."landing_pages" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own pages" ON "public"."pages" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own posts" ON "public"."social_posts" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own sections" ON "public"."page_sections" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own email campaigns" ON "public"."email_campaigns" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own subscribers" ON "public"."subscribers" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own campaigns" ON "public"."ads_campaigns" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notes and reminders" ON "public"."notes_reminders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own projects" ON "public"."projects" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can upload their own assets" ON "public"."assets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own credentials" ON "public"."project_credentials" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own credits" ON "public"."nx_usage_credits" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own diagnostic leads" ON "public"."leads_diagnostico" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own email campaigns" ON "public"."email_campaigns" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own invoices" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own meta connection status" ON "public"."meta_connections" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "meta_connections"."project_id") AND ("projects"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own projects" ON "public"."projects" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscribers" ON "public"."subscribers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscriptions" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own assets" ON "public"."assets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own campaigns" ON "public"."ads_campaigns" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own consents" ON "public"."legal_consents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notes and reminders" ON "public"."notes_reminders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own performance scans" ON "public"."performance_scans" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "performance_scans"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their projects" ON "public"."projects" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Utilizadores gerem os seus documentos legais" ON "public"."compliance_pages" TO "authenticated" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ads_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concierge_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concierge_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."landing_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads_diagnostico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_contents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nx_company_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nx_usage_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_scans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




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



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_invoices_to_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_invoices_to_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_invoices_to_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



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



GRANT ALL ON TABLE "public"."email_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."email_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."email_campaigns" TO "service_role";



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



GRANT ALL ON TABLE "public"."user_assets" TO "anon";
GRANT ALL ON TABLE "public"."user_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_assets" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









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



































CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

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



