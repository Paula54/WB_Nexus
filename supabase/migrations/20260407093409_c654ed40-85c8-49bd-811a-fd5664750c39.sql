
-- Fix 1: Remove dangerous INSERT and UPDATE policies on subscriptions
-- Only the stripe-webhook (service_role) should write to this table
DROP POLICY IF EXISTS "Users can create their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.subscriptions;

-- Fix 2: Remove dangerous INSERT policy on nx_usage_credits
-- Credits should only be managed server-side
DROP POLICY IF EXISTS "Users can create their own credits" ON public.nx_usage_credits;
DROP POLICY IF EXISTS "Users can insert their own credits" ON public.nx_usage_credits;

-- Also remove UPDATE policy on nx_usage_credits to prevent users from resetting used_credits
DROP POLICY IF EXISTS "Users can update their own credits" ON public.nx_usage_credits;

-- Fix 3: Restrict conversation_messages SELECT to only the lead owner
-- First drop the overly permissive policy if it exists
DROP POLICY IF EXISTS "Users can view conversation messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Users can read conversation messages" ON public.conversation_messages;

-- Create a proper scoped SELECT policy: user can only see messages for leads they own
CREATE POLICY "Users can view their own lead messages"
ON public.conversation_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = conversation_messages.lead_id
    AND leads.user_id = auth.uid()
  )
);
