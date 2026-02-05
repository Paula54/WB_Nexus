-- Create storage bucket for social media images
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-images', 'social-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload social images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'social-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update their own social images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'social-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete their own social images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'social-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to all social images
CREATE POLICY "Public read access for social images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'social-images');