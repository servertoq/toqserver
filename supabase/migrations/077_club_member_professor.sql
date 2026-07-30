-- Cargo "Professor" no clube (não relacionado ao plano de billing "professor").
-- Flag independente do role owner/moderator/member para permitir acumulação (ex.: moderador + professor).

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS is_club_professor BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.community_members.is_club_professor IS
  'Professor do clube (cargo interno). Independente do plano de assinatura professor.';

CREATE OR REPLACE FUNCTION public.set_club_professor(
  p_community_id UUID,
  p_user_id UUID,
  p_is_professor BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
BEGIN
  IF NOT public.can_moderate_community(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores e moderadores podem definir professores do clube';
  END IF;

  SELECT kind INTO v_kind
  FROM public.communities
  WHERE id = p_community_id;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Clube não encontrado';
  END IF;

  IF v_kind <> 'club' THEN
    RAISE EXCEPTION 'O cargo de professor só existe em clubes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'O usuário precisa ser membro do clube';
  END IF;

  UPDATE public.community_members
  SET is_club_professor = COALESCE(p_is_professor, false)
  WHERE community_id = p_community_id
    AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_club_professor(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_club_professor(UUID, UUID, BOOLEAN) TO authenticated;
