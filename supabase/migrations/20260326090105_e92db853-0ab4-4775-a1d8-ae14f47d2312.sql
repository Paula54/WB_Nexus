
CREATE TABLE public.legal_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  plan_selected text DEFAULT 'START',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX legal_consents_user_id_idx ON public.legal_consents (user_id);

CREATE POLICY "Users can view their own consent" ON public.legal_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent" ON public.legal_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
