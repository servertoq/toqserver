-- =============================================================================
-- Toq Tennis — Feed social (posts, comunidades, curtidas, comentários)
-- =============================================================================

CREATE TYPE public.post_type AS ENUM ('player', 'event');

-- -----------------------------------------------------------------------------
-- Comunidades
-- -----------------------------------------------------------------------------
CREATE TABLE public.communities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  member_count  INTEGER NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  accent_color  TEXT NOT NULL DEFAULT '#437df4',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.communities IS 'Comunidades / clubes exibidas no feed';

-- -----------------------------------------------------------------------------
-- Posts
-- -----------------------------------------------------------------------------
CREATE TABLE public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id  UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  post_type     public.post_type NOT NULL DEFAULT 'player',
  title         TEXT,
  body          TEXT NOT NULL CHECK (char_length(trim(body)) >= 1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT posts_body_max CHECK (char_length(body) <= 4000)
);

CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX posts_author_id_idx ON public.posts (author_id);

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Imagens do post
-- -----------------------------------------------------------------------------
CREATE TABLE public.post_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX post_images_post_id_idx ON public.post_images (post_id, sort_order);

-- -----------------------------------------------------------------------------
-- Curtidas
-- -----------------------------------------------------------------------------
CREATE TABLE public.post_likes (
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX post_likes_user_id_idx ON public.post_likes (user_id);

-- -----------------------------------------------------------------------------
-- Comentários
-- -----------------------------------------------------------------------------
CREATE TABLE public.post_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(trim(body)) >= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT post_comments_body_max CHECK (char_length(body) <= 1000)
);

CREATE INDEX post_comments_post_id_idx ON public.post_comments (post_id, created_at);

-- -----------------------------------------------------------------------------
-- Comunidades iniciais (demo)
-- -----------------------------------------------------------------------------
INSERT INTO public.communities (name, slug, description, member_count, accent_color) VALUES
  (
    'Toq Tennis São Paulo',
    'toq-sp',
    'Jogadores da capital — partidas, ranking e eventos abertos toda semana.',
    1842,
    '#437df4'
  ),
  (
    'Beach Tennis Rio',
    'beach-rio',
    'Comunidade de beach tennis no Rio de Janeiro e região.',
    956,
    '#7aad18'
  ),
  (
    'Clube Pinheiros',
    'clube-pinheiros',
    'Membros e convidados do clube — treinos e torneios internos.',
    623,
    '#000040'
  ),
  (
    'Tennis BH',
    'tennis-bh',
    'Belo Horizonte e região metropolitana — encontre parceiros do seu nível.',
    411,
    '#5e94f7'
  );

-- -----------------------------------------------------------------------------
-- RLS — communities (leitura pública autenticada)
-- -----------------------------------------------------------------------------
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comunidades visíveis para autenticados"
  ON public.communities FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- RLS — posts
-- -----------------------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts visíveis para autenticados"
  ON public.posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuário cria próprio post"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Usuário atualiza próprio post"
  ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Usuário remove próprio post"
  ON public.posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- -----------------------------------------------------------------------------
-- RLS — post_images
-- -----------------------------------------------------------------------------
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Imagens visíveis para autenticados"
  ON public.post_images FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autor insere imagens no próprio post"
  ON public.post_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  );

CREATE POLICY "Autor remove imagens do próprio post"
  ON public.post_images FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- RLS — post_likes
-- -----------------------------------------------------------------------------
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Curtidas visíveis para autenticados"
  ON public.post_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuário curte posts"
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário remove própria curtida"
  ON public.post_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RLS — post_comments
-- -----------------------------------------------------------------------------
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comentários visíveis para autenticados"
  ON public.post_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuário comenta em posts"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Usuário remove próprio comentário"
  ON public.post_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- -----------------------------------------------------------------------------
-- Storage — imagens de posts
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Imagens de posts — leitura pública"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'post-images');

CREATE POLICY "Usuário envia imagem de post"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Usuário remove imagem de post"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
