-- =============================================================================
-- Toq Tennis — Publicidade / notícias de marketing
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.advertising_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
  card_excerpt TEXT NOT NULL DEFAULT '' CHECK (char_length(card_excerpt) <= 280),
  body_html TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT NOT NULL,
  card_image_url TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advertising_articles_published_idx
  ON public.advertising_articles (is_published, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS advertising_articles_slug_idx
  ON public.advertising_articles (slug);

CREATE OR REPLACE FUNCTION public.set_advertising_articles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.is_published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  IF NOT NEW.is_published THEN
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advertising_articles_updated_at ON public.advertising_articles;
CREATE TRIGGER advertising_articles_updated_at
  BEFORE INSERT OR UPDATE ON public.advertising_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_advertising_articles_updated_at();

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_manage_advertising(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = p_user_id AND role IN ('ceo', 'cto', 'marketing')
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_advertising_manager()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_advertising(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar publicidade';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_ad_carousel_articles(p_limit INT DEFAULT 5)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  card_excerpt TEXT,
  card_image_url TEXT,
  published_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.slug,
    a.title,
    a.card_excerpt,
    a.card_image_url,
    a.published_at
  FROM public.advertising_articles a
  WHERE a.is_published = true
  ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 5);
$$;

REVOKE ALL ON FUNCTION public.can_manage_advertising(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_advertising_manager() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_ad_carousel_articles(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_advertising(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_ad_carousel_articles(INT) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.advertising_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publicidade publicada visível" ON public.advertising_articles;
CREATE POLICY "Publicidade publicada visível"
  ON public.advertising_articles FOR SELECT TO authenticated
  USING (is_published = true OR public.can_manage_advertising(auth.uid()));

DROP POLICY IF EXISTS "Marketing cria publicidade" ON public.advertising_articles;
CREATE POLICY "Marketing cria publicidade"
  ON public.advertising_articles FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_advertising(auth.uid())
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "Marketing atualiza publicidade" ON public.advertising_articles;
CREATE POLICY "Marketing atualiza publicidade"
  ON public.advertising_articles FOR UPDATE TO authenticated
  USING (public.can_manage_advertising(auth.uid()))
  WITH CHECK (public.can_manage_advertising(auth.uid()));

DROP POLICY IF EXISTS "Marketing remove publicidade" ON public.advertising_articles;
CREATE POLICY "Marketing remove publicidade"
  ON public.advertising_articles FOR DELETE TO authenticated
  USING (public.can_manage_advertising(auth.uid()));

-- -----------------------------------------------------------------------------
-- Storage — imagens de publicidade
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'advertising-images',
  'advertising-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Imagens publicidade — leitura pública" ON storage.objects;
CREATE POLICY "Imagens publicidade — leitura pública"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'advertising-images');

DROP POLICY IF EXISTS "Marketing envia imagem publicidade" ON storage.objects;
CREATE POLICY "Marketing envia imagem publicidade"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'advertising-images'
    AND public.can_manage_advertising(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Marketing remove imagem publicidade" ON storage.objects;
CREATE POLICY "Marketing remove imagem publicidade"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'advertising-images'
    AND public.can_manage_advertising(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
