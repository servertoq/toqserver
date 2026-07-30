-- Favoritos de clube (apenas membros podem favoritar)
-- Idempotente

CREATE TABLE IF NOT EXISTS public.community_favorites (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, community_id)
);

CREATE INDEX IF NOT EXISTS community_favorites_user_id_idx
  ON public.community_favorites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS community_favorites_community_id_idx
  ON public.community_favorites (community_id);

ALTER TABLE public.community_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário lê próprios favoritos" ON public.community_favorites;
CREATE POLICY "Usuário lê próprios favoritos"
  ON public.community_favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Membro favorita clube" ON public.community_favorites;
CREATE POLICY "Membro favorita clube"
  ON public.community_favorites FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_community_member(community_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_id AND c.kind = 'club'
    )
  );

DROP POLICY IF EXISTS "Usuário remove próprio favorito" ON public.community_favorites;
CREATE POLICY "Usuário remove próprio favorito"
  ON public.community_favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Remove favorito ao sair do clube/comunidade
CREATE OR REPLACE FUNCTION public.clear_community_favorite_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.community_favorites
  WHERE community_id = OLD.community_id
    AND user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS community_members_clear_favorite ON public.community_members;
CREATE TRIGGER community_members_clear_favorite
  AFTER DELETE ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_community_favorite_on_leave();
