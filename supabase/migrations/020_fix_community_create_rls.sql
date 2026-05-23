-- =============================================================================
-- Toq Tennis — Corrige criação de comunidades/clubes (RLS INSERT + RETURNING)
-- =============================================================================

-- Criador sempre pode ler o registro (necessário para .insert().select() em clubes privados)
DROP POLICY IF EXISTS "Comunidades e clubes visíveis conforme tipo" ON public.communities;

CREATE POLICY "Comunidades e clubes visíveis conforme tipo"
  ON public.communities FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR kind = 'community'::public.community_kind
    OR public.is_community_member(id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.community_join_requests
      WHERE community_id = id
        AND user_id = auth.uid()
        AND status = 'pending'
    )
    OR EXISTS (
      SELECT 1 FROM public.community_invites
      WHERE community_id = id
        AND invitee_id = auth.uid()
        AND status = 'pending'
    )
  );

DROP POLICY IF EXISTS "Usuário cria comunidade" ON public.communities;
DROP POLICY IF EXISTS "Usuário cria comunidade ou clube" ON public.communities;

CREATE POLICY "Usuário cria comunidade ou clube"
  ON public.communities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE OR REPLACE FUNCTION public.create_community(
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT,
  p_is_private BOOLEAN DEFAULT false,
  p_kind public.community_kind DEFAULT 'community',
  p_accent_color TEXT DEFAULT '#437df4'
)
RETURNS TABLE(id UUID, slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_private BOOLEAN := p_is_private;
  v_id UUID;
  v_slug TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF TRIM(p_name) = '' OR TRIM(p_slug) = '' THEN
    RAISE EXCEPTION 'Nome e identificador são obrigatórios';
  END IF;

  IF p_kind = 'club'::public.community_kind THEN
    v_private := true;
  END IF;

  INSERT INTO public.communities (
    name, slug, description, is_private, kind, created_by, accent_color
  )
  VALUES (
    TRIM(p_name),
    TRIM(p_slug),
    TRIM(p_description),
    v_private,
    p_kind,
    v_uid,
    COALESCE(NULLIF(TRIM(p_accent_color), ''), '#437df4')
  )
  RETURNING communities.id, communities.slug INTO v_id, v_slug;

  RETURN QUERY SELECT v_id, v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_community(TEXT, TEXT, TEXT, BOOLEAN, public.community_kind, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_community(TEXT, TEXT, TEXT, BOOLEAN, public.community_kind, TEXT) TO authenticated;
