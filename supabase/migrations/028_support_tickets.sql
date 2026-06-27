-- Suporte: denúncias, sugestões e pedidos de ajuda
-- Idempotente: pode rodar de novo se a tabela já existir

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL CHECK (topic IN ('report', 'suggestion', 'help')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 10),
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON public.support_tickets (created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário cria ticket de suporte" ON public.support_tickets;
CREATE POLICY "Usuário cria ticket de suporte"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário vê próprios tickets" ON public.support_tickets;
CREATE POLICY "Usuário vê próprios tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Storage — imagens anexadas ao suporte
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-images',
  'support-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Imagens de suporte — leitura pública" ON storage.objects;
CREATE POLICY "Imagens de suporte — leitura pública"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'support-images');

DROP POLICY IF EXISTS "Usuário envia imagem de suporte" ON storage.objects;
CREATE POLICY "Usuário envia imagem de suporte"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Usuário remove imagem de suporte" ON storage.objects;
CREATE POLICY "Usuário remove imagem de suporte"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
