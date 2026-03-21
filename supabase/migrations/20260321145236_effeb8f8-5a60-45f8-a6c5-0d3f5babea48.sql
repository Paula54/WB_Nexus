
-- Create the nx_usage_credits table
CREATE TABLE public.nx_usage_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_credits integer NOT NULL DEFAULT 100,
  used_credits integer NOT NULL DEFAULT 0,
  plan_name text NOT NULL DEFAULT 'Start',
  last_reset timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.nx_usage_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "Users can view their own credits"
  ON public.nx_usage_credits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own credits row
CREATE POLICY "Users can insert their own credits"
  ON public.nx_usage_credits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own credits
CREATE POLICY "Users can update their own credits"
  ON public.nx_usage_credits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
