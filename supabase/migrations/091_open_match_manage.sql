-- =============================================================================
-- Partidas: editar local/data, expulsar jogador, excluir com notificação
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_open_match(
  p_match_id UUID,
  p_court_name TEXT,
  p_city TEXT,
  p_starts_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_match public.open_matches%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match
  FROM public.open_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND OR v_match.created_by <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('cancelled', 'done') THEN
    RAISE EXCEPTION 'Partida indisponível';
  END IF;

  IF NULLIF(trim(p_court_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da quadra';
  END IF;

  IF NULLIF(trim(p_city), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a cidade (via CEP)';
  END IF;

  IF p_starts_at IS NULL OR p_starts_at < (now() - INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Data/hora da partida inválida';
  END IF;

  UPDATE public.open_matches
  SET
    court_name = left(trim(p_court_name), 80),
    city = left(trim(p_city), 80),
    starts_at = p_starts_at
  WHERE id = p_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_open_match(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_open_match(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.kick_open_match_player(
  p_match_id UUID,
  p_user_id UUID
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

  SELECT * INTO v_match
  FROM public.open_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND OR v_match.created_by <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('cancelled', 'done') THEN
    RAISE EXCEPTION 'Partida indisponível';
  END IF;

  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'Você não pode se expulsar da própria partida';
  END IF;

  SELECT * INTO v_row
  FROM public.open_match_players
  WHERE match_id = p_match_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.status NOT IN ('confirmed', 'pending') THEN
    RAISE EXCEPTION 'Jogador não encontrado nesta partida';
  END IF;

  DELETE FROM public.open_match_players
  WHERE id = v_row.id;

  PERFORM public.refresh_open_match_status(p_match_id);

  PERFORM public.create_notification(
    p_user_id,
    v_uid,
    'open_match_removed'::public.notification_type,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kick_open_match_player(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kick_open_match_player(UUID, UUID) TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_open_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_match public.open_matches%ROWTYPE;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match
  FROM public.open_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND OR v_match.created_by <> v_uid THEN
    RAISE EXCEPTION 'Partida não encontrada ou sem permissão';
  END IF;

  IF v_match.status = 'cancelled' THEN
    RETURN;
  END IF;

  UPDATE public.open_matches
  SET status = 'cancelled'
  WHERE id = p_match_id;

  -- Notifica quem estava na partida (confirmado ou pendente), exceto o criador
  FOR r IN
    SELECT DISTINCT p.user_id
    FROM public.open_match_players p
    WHERE p.match_id = p_match_id
      AND p.user_id <> v_uid
      AND p.status IN ('confirmed', 'pending')
  LOOP
    PERFORM public.create_notification(
      r.user_id,
      v_uid,
      'open_match_cancelled'::public.notification_type,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_open_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_open_match(UUID) TO authenticated;
