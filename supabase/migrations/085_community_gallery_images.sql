-- Galeria de fotos do clube/comunidade (além da capa)
-- Idempotente. Storage: usa bucket community-covers (políticas já existentes).

CREATE TABLE IF NOT EXISTS public.community_gallery_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_gallery_images_url_len CHECK (char_length(trim(url)) >= 8)
);

CREATE INDEX IF NOT EXISTS community_gallery_images_community_idx
  ON public.community_gallery_images (community_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION public.community_gallery_images_max_eight()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.community_gallery_images
  WHERE community_id = NEW.community_id;

  IF TG_OP = 'INSERT' AND v_count >= 8 THEN
    RAISE EXCEPTION 'Limite de 8 fotos na galeria deste grupo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_gallery_images_limit ON public.community_gallery_images;
CREATE TRIGGER community_gallery_images_limit
  BEFORE INSERT ON public.community_gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION public.community_gallery_images_max_eight();

ALTER TABLE public.community_gallery_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Galeria visível para autenticados" ON public.community_gallery_images;
CREATE POLICY "Galeria visível para autenticados"
  ON public.community_gallery_images FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Moderadores inserem fotos da galeria" ON public.community_gallery_images;
CREATE POLICY "Moderadores inserem fotos da galeria"
  ON public.community_gallery_images FOR INSERT TO authenticated
  WITH CHECK (public.can_moderate_community(community_id, auth.uid()));

DROP POLICY IF EXISTS "Moderadores atualizam fotos da galeria" ON public.community_gallery_images;
CREATE POLICY "Moderadores atualizam fotos da galeria"
  ON public.community_gallery_images FOR UPDATE TO authenticated
  USING (public.can_moderate_community(community_id, auth.uid()))
  WITH CHECK (public.can_moderate_community(community_id, auth.uid()));

DROP POLICY IF EXISTS "Moderadores removem fotos da galeria" ON public.community_gallery_images;
CREATE POLICY "Moderadores removem fotos da galeria"
  ON public.community_gallery_images FOR DELETE TO authenticated
  USING (public.can_moderate_community(community_id, auth.uid()));
