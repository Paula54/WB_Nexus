
-- 1) Unique constraint on subscriptions to prevent duplicates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_stripe_sub_unique'
  ) THEN
    -- Deduplicate before adding constraint
    DELETE FROM public.subscriptions a USING public.subscriptions b
    WHERE a.ctid < b.ctid
      AND a.stripe_subscription_id IS NOT NULL
      AND a.stripe_subscription_id = b.stripe_subscription_id;

    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_stripe_sub_unique UNIQUE (stripe_subscription_id);
  END IF;
END $$;

-- 2) Missing UPDATE policy on legal_consents
DROP POLICY IF EXISTS "Users can update their own consent" ON public.legal_consents;
CREATE POLICY "Users can update their own consent"
ON public.legal_consents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) Auto-initialize AI Fuel credits on new profile
CREATE OR REPLACE FUNCTION public.init_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.nx_usage_credits (user_id, total_credits, used_credits, plan_name)
  VALUES (NEW.user_id, 100, 0, 'Start')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_user_credits ON public.profiles;
CREATE TRIGGER trg_init_user_credits
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.init_user_credits();

-- Add UNIQUE on nx_usage_credits.user_id to make ON CONFLICT work
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nx_usage_credits_user_unique'
  ) THEN
    DELETE FROM public.nx_usage_credits a USING public.nx_usage_credits b
    WHERE a.ctid < b.ctid AND a.user_id = b.user_id;
    ALTER TABLE public.nx_usage_credits
      ADD CONSTRAINT nx_usage_credits_user_unique UNIQUE (user_id);
  END IF;
END $$;

-- 4) Backfill credits for existing profiles missing the record
INSERT INTO public.nx_usage_credits (user_id, total_credits, used_credits, plan_name)
SELECT p.user_id, 100, 0, 'Start'
FROM public.profiles p
LEFT JOIN public.nx_usage_credits c ON c.user_id = p.user_id
WHERE c.user_id IS NULL
ON CONFLICT DO NOTHING;
