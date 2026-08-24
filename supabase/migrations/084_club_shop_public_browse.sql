-- Loja do clube: qualquer autenticado pode ver produtos quando shop_enabled
-- Idempotente

DROP POLICY IF EXISTS "Produtos visíveis para membros do clube" ON public.club_products;
DROP POLICY IF EXISTS "Produtos da loja visíveis quando ativa" ON public.club_products;
CREATE POLICY "Produtos da loja visíveis quando ativa"
  ON public.club_products FOR SELECT TO authenticated
  USING (
    public.is_club_community(community_id)
    AND (
      public.is_community_member(community_id, auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.communities c
        WHERE c.id = community_id
          AND c.shop_enabled = true
      )
    )
  );

DROP POLICY IF EXISTS "Imagens de produto visíveis para membros" ON public.club_product_images;
DROP POLICY IF EXISTS "Imagens de produto da loja visíveis quando ativa" ON public.club_product_images;
CREATE POLICY "Imagens de produto da loja visíveis quando ativa"
  ON public.club_product_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_products p
      WHERE p.id = product_id
        AND public.is_club_community(p.community_id)
        AND (
          public.is_community_member(p.community_id, auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.communities c
            WHERE c.id = p.community_id
              AND c.shop_enabled = true
          )
        )
    )
  );

DROP POLICY IF EXISTS "Variantes visíveis para membros do clube" ON public.club_product_variants;
DROP POLICY IF EXISTS "Variantes da loja visíveis quando ativa" ON public.club_product_variants;
CREATE POLICY "Variantes da loja visíveis quando ativa"
  ON public.club_product_variants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_products p
      WHERE p.id = product_id
        AND public.is_club_community(p.community_id)
        AND (
          public.is_community_member(p.community_id, auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.communities c
            WHERE c.id = p.community_id
              AND c.shop_enabled = true
          )
        )
    )
  );
