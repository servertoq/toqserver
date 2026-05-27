-- =============================================================================
-- Toq Tennis — Clube: loja, produtos e ranking
-- =============================================================================

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS shop_enabled BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- Produtos da loja do clube
-- -----------------------------------------------------------------------------
CREATE TABLE public.club_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  size_label    TEXT,
  color         TEXT,
  numbering     TEXT,
  price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_products_name_len CHECK (char_length(trim(name)) >= 2)
);

CREATE INDEX club_products_community_idx ON public.club_products (community_id, sort_order);

CREATE OR REPLACE FUNCTION public.set_club_row_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER club_products_updated_at
  BEFORE UPDATE ON public.club_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_club_row_updated_at();

CREATE TABLE public.club_product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.club_products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX club_product_images_product_idx ON public.club_product_images (product_id, sort_order);

CREATE OR REPLACE FUNCTION public.club_product_images_max_three()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.club_product_images
  WHERE product_id = NEW.product_id;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Máximo de 3 imagens por produto';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER club_product_images_limit
  BEFORE INSERT ON public.club_product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.club_product_images_max_three();

-- -----------------------------------------------------------------------------
-- Ranking do clube
-- -----------------------------------------------------------------------------
CREATE TABLE public.club_ranking_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  unit_label    TEXT NOT NULL DEFAULT 'pontos',
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_ranking_categories_name_len CHECK (char_length(trim(name)) >= 2)
);

CREATE INDEX club_ranking_categories_community_idx
  ON public.club_ranking_categories (community_id, sort_order);

CREATE TABLE public.club_ranking_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES public.club_ranking_categories(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes         TEXT,
  updated_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, user_id)
);

CREATE INDEX club_ranking_entries_category_idx
  ON public.club_ranking_entries (category_id, score DESC);

CREATE TRIGGER club_ranking_entries_updated_at
  BEFORE UPDATE ON public.club_ranking_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_club_row_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_club_community(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND kind = 'club'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_club_community(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS — club_products
-- -----------------------------------------------------------------------------
ALTER TABLE public.club_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtos visíveis para membros do clube"
  ON public.club_products FOR SELECT TO authenticated
  USING (
    public.is_community_member(community_id, auth.uid())
    AND public.is_club_community(community_id)
  );

CREATE POLICY "Moderadores gerenciam produtos"
  ON public.club_products FOR INSERT TO authenticated
  WITH CHECK (
    public.can_moderate_community(community_id, auth.uid())
    AND public.is_club_community(community_id)
  );

CREATE POLICY "Moderadores atualizam produtos"
  ON public.club_products FOR UPDATE TO authenticated
  USING (public.can_moderate_community(community_id, auth.uid()))
  WITH CHECK (public.can_moderate_community(community_id, auth.uid()));

CREATE POLICY "Moderadores removem produtos"
  ON public.club_products FOR DELETE TO authenticated
  USING (public.can_moderate_community(community_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- RLS — club_product_images
-- -----------------------------------------------------------------------------
ALTER TABLE public.club_product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Imagens de produto visíveis para membros"
  ON public.club_product_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_products p
      WHERE p.id = product_id
        AND public.is_community_member(p.community_id, auth.uid())
    )
  );

CREATE POLICY "Moderadores inserem imagens de produto"
  ON public.club_product_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_products p
      WHERE p.id = product_id
        AND public.can_moderate_community(p.community_id, auth.uid())
    )
  );

CREATE POLICY "Moderadores removem imagens de produto"
  ON public.club_product_images FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_products p
      WHERE p.id = product_id
        AND public.can_moderate_community(p.community_id, auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- RLS — ranking
-- -----------------------------------------------------------------------------
ALTER TABLE public.club_ranking_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_ranking_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias de ranking visíveis para membros"
  ON public.club_ranking_categories FOR SELECT TO authenticated
  USING (
    public.is_community_member(community_id, auth.uid())
    AND public.is_club_community(community_id)
  );

CREATE POLICY "Moderadores gerenciam categorias"
  ON public.club_ranking_categories FOR ALL TO authenticated
  USING (public.can_moderate_community(community_id, auth.uid()))
  WITH CHECK (public.can_moderate_community(community_id, auth.uid()));

CREATE POLICY "Entradas de ranking visíveis para membros"
  ON public.club_ranking_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_ranking_categories c
      WHERE c.id = category_id
        AND public.is_community_member(c.community_id, auth.uid())
    )
  );

CREATE POLICY "Moderadores gerenciam entradas de ranking"
  ON public.club_ranking_entries FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_ranking_categories c
      WHERE c.id = category_id
        AND public.can_moderate_community(c.community_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_ranking_categories c
      WHERE c.id = category_id
        AND public.can_moderate_community(c.community_id, auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Storage — imagens de produtos do clube
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-product-images',
  'club-product-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Imagens de produto do clube — leitura pública"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'club-product-images');

CREATE POLICY "Moderador envia imagem de produto"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-product-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Moderador atualiza imagem de produto"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-product-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Moderador remove imagem de produto"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-product-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
