-- =============================================================================
-- Toq Tennis — Loja do clube: variantes (SKU) + WhatsApp do vendedor
-- =============================================================================

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS shop_whatsapp TEXT;

CREATE TABLE public.club_product_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES public.club_products(id) ON DELETE CASCADE,
  size_label    TEXT,
  color         TEXT,
  numbering     TEXT,
  price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX club_product_variants_product_idx ON public.club_product_variants (product_id, sort_order);

-- Migrar produtos existentes para uma variante cada
INSERT INTO public.club_product_variants (product_id, size_label, color, numbering, price, sort_order)
SELECT id, size_label, color, numbering, price, 0
FROM public.club_products
WHERE NOT EXISTS (
  SELECT 1 FROM public.club_product_variants v WHERE v.product_id = club_products.id
);

-- -----------------------------------------------------------------------------
-- RLS — club_product_variants
-- -----------------------------------------------------------------------------
ALTER TABLE public.club_product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Variantes visíveis para membros do clube"
  ON public.club_product_variants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_products p
      WHERE p.id = product_id
        AND public.is_community_member(p.community_id, auth.uid())
    )
  );

CREATE POLICY "Moderadores gerenciam variantes"
  ON public.club_product_variants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_products p
      WHERE p.id = product_id
        AND public.can_moderate_community(p.community_id, auth.uid())
    )
  );

CREATE POLICY "Moderadores atualizam variantes"
  ON public.club_product_variants FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_products p
      WHERE p.id = product_id
        AND public.can_moderate_community(p.community_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_products p
      WHERE p.id = product_id
        AND public.can_moderate_community(p.community_id, auth.uid())
    )
  );

CREATE POLICY "Moderadores removem variantes"
  ON public.club_product_variants FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_products p
      WHERE p.id = product_id
        AND public.can_moderate_community(p.community_id, auth.uid())
    )
  );
