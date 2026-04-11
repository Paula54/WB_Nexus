DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);