-- Reparo: bucket e políticas de imagem dos torneios (rode se 026 falhou no meio)
-- Seguro rodar várias vezes

ALTER TABLE public.club_tournaments
  ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-tournament-images',
  'club-tournament-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Imagens de torneio públicas" ON storage.objects;
CREATE POLICY "Imagens de torneio públicas"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'club-tournament-images');

DROP POLICY IF EXISTS "Moderador envia imagem de torneio" ON storage.objects;
CREATE POLICY "Moderador envia imagem de torneio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-tournament-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Moderador atualiza imagem de torneio" ON storage.objects;
CREATE POLICY "Moderador atualiza imagem de torneio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-tournament-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Moderador remove imagem de torneio" ON storage.objects;
CREATE POLICY "Moderador remove imagem de torneio"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-tournament-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
