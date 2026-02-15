
-- Add fair-use / credits columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_credits_limit integer NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS ai_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_images_limit integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ai_images_used integer NOT NULL DEFAULT 0;
