-- Bucket público para imagens do Site Builder
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública
CREATE POLICY "site-images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-images');

-- Upload apenas autenticados, dentro da própria pasta {user_id}/...
CREATE POLICY "site-images authenticated insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Update apenas pelo dono
CREATE POLICY "site-images owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'site-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Delete apenas pelo dono
CREATE POLICY "site-images owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'site-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);