-- =============================================================================
-- Aceitar convite NÃO confirma na partida: vira pedido (pending) para o criador.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.respond_open_match_invite(
  p_match_id UUID,
  p_accept BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_match public.open_matches%ROWTYPE;
  v_row public.open_match_players%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match FROM public.open_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada';
  END IF;

  IF v_match.status IN ('cancelled', 'done') THEN
    RAISE EXCEPTION 'Partida indisponível';
  END IF;

  SELECT * INTO v_row
  FROM public.open_match_players
  WHERE match_id = p_match_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND OR v_row.status <> 'invited' THEN
    RAISE EXCEPTION 'Convite não encontrado';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.open_match_players
    SET status = 'rejected'
    WHERE id = v_row.id;

    UPDATE public.notifications
    SET read_at = coalesce(read_at, now())
    WHERE recipient_id = v_uid
      AND open_match_id = p_match_id
      AND type = 'open_match_invite'::public.notification_type
      AND read_at IS NULL;
    RETURN;
  END IF;

  IF public.open_match_confirmed_count(p_match_id) >= v_match.capacity THEN
    RAISE EXCEPTION 'Partida lotada';
  END IF;

  -- Aceitou o convite: agora é pedido pendente para o criador decidir
  UPDATE public.open_match_players
  SET status = 'pending'
  WHERE id = v_row.id;

  UPDATE public.notifications
  SET read_at = coalesce(read_at, now())
  WHERE recipient_id = v_uid
    AND open_match_id = p_match_id
    AND type = 'open_match_invite'::public.notification_type
    AND read_at IS NULL;

  -- Avisa o criador que o convidado quer entrar
  INSERT INTO public.notifications (
    recipient_id, actor_id, type, open_match_id, community_id
  ) VALUES (
    v_match.created_by,
    v_uid,
    'open_match_join_request'::public.notification_type,
    p_match_id,
    v_match.community_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_open_match_invite(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_open_match_invite(UUID, BOOLEAN) TO authenticated;
