
-- Subscribers table
CREATE TABLE public.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscribers" ON public.subscribers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own subscribers" ON public.subscribers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscribers" ON public.subscribers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own subscribers" ON public.subscribers FOR DELETE USING (auth.uid() = user_id);

-- Email campaigns table
CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  from_name text DEFAULT 'Nexus Machine',
  from_email text DEFAULT 'newsletter@mail.web-business.pt',
  status text NOT NULL DEFAULT 'draft',
  sent_count integer DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email campaigns" ON public.email_campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own email campaigns" ON public.email_campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own email campaigns" ON public.email_campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own email campaigns" ON public.email_campaigns FOR DELETE USING (auth.uid() = user_id);

-- Add email send tracking to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_sends_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_sends_limit integer NOT NULL DEFAULT 500;
