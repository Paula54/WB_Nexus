-- Centralizar DNA do negócio na tabela projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Portugal',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS business_sector text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS complaints_book_url text,
  ADD COLUMN IF NOT EXISTS dre_url text;

-- Migrar dados existentes de business_profiles -> projects (1 projeto mais antigo por user)
UPDATE public.projects p
SET
  legal_name           = COALESCE(p.legal_name, bp.legal_name),
  trade_name           = COALESCE(p.trade_name, bp.trade_name),
  nif                  = COALESCE(p.nif, bp.nif),
  address_line1        = COALESCE(p.address_line1, bp.address_line1),
  address_line2        = COALESCE(p.address_line2, bp.address_line2),
  postal_code          = COALESCE(p.postal_code, bp.postal_code),
  city                 = COALESCE(p.city, bp.city),
  country              = COALESCE(p.country, bp.country),
  phone                = COALESCE(p.phone, bp.phone),
  website              = COALESCE(p.website, bp.website),
  email                = COALESCE(p.email, bp.email),
  logo_url             = COALESCE(p.logo_url, bp.logo_url),
  facebook_url         = COALESCE(p.facebook_url, bp.facebook_url),
  instagram_url        = COALESCE(p.instagram_url, bp.instagram_url),
  linkedin_url         = COALESCE(p.linkedin_url, bp.linkedin_url),
  complaints_book_url  = COALESCE(p.complaints_book_url, bp.complaints_book_url),
  dre_url              = COALESCE(p.dre_url, bp.dre_url)
FROM public.business_profiles bp
WHERE bp.user_id = p.user_id
  AND p.id = (
    SELECT id FROM public.projects
    WHERE user_id = bp.user_id
    ORDER BY created_at ASC
    LIMIT 1
  );

-- Migrar business_sector de profiles -> projects (mais antigo)
UPDATE public.projects p
SET business_sector = COALESCE(p.business_sector, pr.business_sector)
FROM public.profiles pr
WHERE pr.user_id = p.user_id
  AND p.id = (
    SELECT id FROM public.projects
    WHERE user_id = pr.user_id
    ORDER BY created_at ASC
    LIMIT 1
  );