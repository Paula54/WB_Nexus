
-- Drop the insecure UPDATE policy
DROP POLICY IF EXISTS "Users can update their own credits" ON public.nx_usage_credits;

-- Create a secure RPC function that only increments used_credits
CREATE OR REPLACE FUNCTION public.spend_credits(p_action text, p_cost integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_used integer;
BEGIN
  SELECT total_credits, used_credits INTO v_total, v_used
  FROM nx_usage_credits
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF (v_used + p_cost) > v_total THEN
    RETURN false;
  END IF;

  UPDATE nx_usage_credits
  SET used_credits = used_credits + p_cost, updated_at = now()
  WHERE user_id = auth.uid();

  RETURN true;
END;
$$;
