
-- Add unique constraint on stripe_subscription_id for upsert operations
ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
