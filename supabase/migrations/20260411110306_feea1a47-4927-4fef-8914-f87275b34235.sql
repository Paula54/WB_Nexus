-- Remove the overly broad public SELECT policy on the assets bucket
DROP POLICY IF EXISTS "Assets are publicly readable" ON storage.objects;