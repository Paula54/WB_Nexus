
-- Wallet transactions table
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'domain_purchase', 'ad_credit')),
  description TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
ON public.wallet_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
ON public.wallet_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Domain registrations table
CREATE TABLE public.domain_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  purchase_price NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL,
  expiry_date TIMESTAMP WITH TIME ZONE,
  nameservers TEXT[],
  porkbun_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.domain_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own domains"
ON public.domain_registrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own domains"
ON public.domain_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own domains"
ON public.domain_registrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_domain_registrations_updated_at
BEFORE UPDATE ON public.domain_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
