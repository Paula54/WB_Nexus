-- Fix 1: Remove public INSERT policy on wallet_transactions
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.wallet_transactions;

-- Fix 2: Remove conversation_messages from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.conversation_messages;