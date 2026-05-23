-- =============================================================================
-- Toq Tennis — Ao expulsar membro, remove posts dele na comunidade/clube
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remove_community_member(
  p_community_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role public.community_member_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT role INTO v_target_role
  FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Não é possível remover o administrador';
  END IF;

  -- Saída voluntária: remove só a associação, mantém publicações
  IF p_user_id = auth.uid() THEN
    DELETE FROM public.community_members
    WHERE community_id = p_community_id AND user_id = p_user_id;
    RETURN;
  END IF;

  IF NOT public.can_moderate_community(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para expulsar membros';
  END IF;

  IF v_target_role = 'moderator' AND NOT public.is_community_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o administrador pode remover moderadores';
  END IF;

  -- Publicações do membro nesta comunidade/clube (cascata: likes, comentários, imagens)
  DELETE FROM public.posts
  WHERE community_id = p_community_id
    AND author_id = p_user_id;

  -- Limpa convites e pedidos pendentes do expulso
  DELETE FROM public.community_invites
  WHERE community_id = p_community_id
    AND invitee_id = p_user_id
    AND status = 'pending';

  DELETE FROM public.community_join_requests
  WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND status = 'pending';

  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_community_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_community_member(UUID, UUID) TO authenticated;
