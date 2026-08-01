-- =============================================================================
-- Ao excluir/desativar quadra ou clube, remover posts de quadra do feed
-- =============================================================================

-- Trigger: DELETE da quadra ou is_active=false → apaga o post vinculado
CREATE OR REPLACE FUNCTION public.cleanup_club_court_feed_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_post_id := OLD.post_id;
    IF v_post_id IS NOT NULL THEN
      DELETE FROM public.posts WHERE id = v_post_id;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: desativou a quadra
  IF TG_OP = 'UPDATE'
     AND NEW.is_active = false
     AND COALESCE(OLD.is_active, true) = true THEN
    v_post_id := COALESCE(NEW.post_id, OLD.post_id);
    NEW.post_id := NULL;
    IF v_post_id IS NOT NULL THEN
      DELETE FROM public.posts WHERE id = v_post_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS club_courts_cleanup_feed_post ON public.club_courts;
CREATE TRIGGER club_courts_cleanup_feed_post
  BEFORE DELETE OR UPDATE OF is_active, post_id
  ON public.club_courts
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_club_court_feed_post();

-- delete_community: remove posts de quadra antes de apagar o clube
CREATE OR REPLACE FUNCTION public.delete_community(p_community_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_community_owner(p_community_id, v_uid) THEN
    RAISE EXCEPTION 'Apenas o administrador pode excluir este grupo';
  END IF;

  -- Posts vinculados às quadras do clube (mesmo com community_id nulo no post)
  DELETE FROM public.posts
  WHERE id IN (
    SELECT cc.post_id
    FROM public.club_courts cc
    WHERE cc.community_id = p_community_id
      AND cc.post_id IS NOT NULL
  );

  -- Posts de tipo court ainda ligados ao community_id
  DELETE FROM public.posts
  WHERE community_id = p_community_id
    AND post_type = 'court'::public.post_type;

  DELETE FROM public.communities WHERE id = p_community_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_community(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_community(UUID) TO authenticated;

-- Staff: mesma limpeza
CREATE OR REPLACE FUNCTION public.staff_delete_community(p_community_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  DELETE FROM public.posts
  WHERE id IN (
    SELECT cc.post_id
    FROM public.club_courts cc
    WHERE cc.community_id = p_community_id
      AND cc.post_id IS NOT NULL
  );

  DELETE FROM public.posts
  WHERE community_id = p_community_id
    AND post_type = 'court'::public.post_type;

  DELETE FROM public.communities WHERE id = p_community_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_delete_community(UUID) TO authenticated;

-- Limpa órfãos já existentes (posts de quadra sem clube/quadra)
DELETE FROM public.posts p
WHERE p.post_type = 'court'::public.post_type
  AND NOT EXISTS (
    SELECT 1 FROM public.club_courts c WHERE c.post_id = p.id AND c.is_active = true
  );
