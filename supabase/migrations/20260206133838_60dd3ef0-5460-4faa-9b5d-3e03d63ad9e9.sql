-- Add business_sector column to profiles for sector specialization
ALTER TABLE public.profiles 
ADD COLUMN business_sector TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.business_sector IS 'Business sector for AI content specialization (e.g., cafetaria, imobiliaria, advocacia)';