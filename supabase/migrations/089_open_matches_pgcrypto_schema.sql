-- =============================================================================
-- Fix: gen_salt/crypt do pgcrypto ficam em extensions (Supabase).
-- Funções SECURITY DEFINER com search_path = public não enxergavam gen_salt.
-- =============================================================================

ALTER FUNCTION public.create_open_match(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT)
  SET search_path = public, extensions;

ALTER FUNCTION public.join_open_match(UUID, TEXT, SMALLINT)
  SET search_path = public, extensions;

-- Garante corpos com schema qualificado (idempotente)
CREATE OR REPLACE FUNCTION public.create_open_match(
  p_format TEXT,
  p_skill_level NUMERIC,
  p_court_name TEXT,
  p_city TEXT,
  p_starts_at TIMESTAMPTZ,
  p_password TEXT DEFAULT NULL,
  p_community_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_cap SMALLINT;
  v_hash TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_format NOT IN ('1v1', '2v2') THEN
    RAISE EXCEPTION 'Formato inválido';
  END IF;

  IF p_skill_level IS NULL OR p_skill_level < 0 OR p_skill_level > 5 THEN
    RAISE EXCEPTION 'Nível deve ser entre 0 e 5';
  END IF;

  IF NULLIF(trim(p_court_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da quadra';
  END IF;

  IF p_starts_at IS NULL OR p_starts_at < (now() - INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Data/hora da partida inválida';
  END IF;

  v_cap := CASE WHEN p_format = '1v1' THEN 2 ELSE 4 END;
  v_hash := CASE
    WHEN NULLIF(trim(p_password), '') IS NULL THEN NULL
    ELSE extensions.crypt(trim(p_password), extensions.gen_salt('bf'))
  END;

  INSERT INTO public.open_matches (
    created_by, format, capacity, skill_level, court_name, city,
    community_id, password_hash, starts_at, notes
  ) VALUES (
    v_uid,
    p_format,
    v_cap,
    round(p_skill_level::numeric, 1),
    trim(p_court_name),
    coalesce(trim(p_city), ''),
    p_community_id,
    v_hash,
    p_starts_at,
    left(coalesce(trim(p_notes), ''), 280)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.open_match_players (match_id, user_id, team, status)
  VALUES (v_id, v_uid, 1, 'confirmed');

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_open_match(
  p_match_id UUID,
  p_password TEXT DEFAULT NULL,
  p_team SMALLINT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_match public.open_matches%ROWTYPE;
  v_team SMALLINT;
  v_t1 INTEGER;
  v_t2 INTEGER;
  v_status TEXT;
  v_existing TEXT;
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

  IF v_match.created_by = v_uid THEN
    RAISE EXCEPTION 'Você já está nesta partida';
  END IF;

  SELECT status INTO v_existing
  FROM public.open_match_players
  WHERE match_id = p_match_id AND user_id = v_uid;

  IF v_existing = 'confirmed' THEN
    RAISE EXCEPTION 'Você já está nesta partida';
  END IF;
  IF v_existing = 'pending' THEN
    RETURN 'pending';
  END IF;

  IF public.open_match_confirmed_count(p_match_id) >= v_match.capacity THEN
    RAISE EXCEPTION 'Partida lotada';
  END IF;

  IF v_match.password_hash IS NOT NULL THEN
    IF NULLIF(trim(coalesce(p_password, '')), '') IS NULL
       OR extensions.crypt(trim(p_password), v_match.password_hash) <> v_match.password_hash THEN
      RAISE EXCEPTION 'Senha incorreta';
    END IF;
    v_status := 'confirmed';
  ELSE
    v_status := 'pending';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_t1
  FROM public.open_match_players
  WHERE match_id = p_match_id AND status = 'confirmed' AND team = 1;
  SELECT COUNT(*)::INTEGER INTO v_t2
  FROM public.open_match_players
  WHERE match_id = p_match_id AND status = 'confirmed' AND team = 2;

  IF p_team IN (1, 2) THEN
    v_team := p_team;
  ELSIF v_match.format = '1v1' THEN
    v_team := 2;
  ELSE
    IF v_t1 < 2 AND (v_t1 <= v_t2 OR v_t2 >= 2) THEN
      v_team := 1;
    ELSE
      v_team := 2;
    END IF;
  END IF;

  IF v_status = 'confirmed' THEN
    IF (v_team = 1 AND v_t1 >= CASE WHEN v_match.format = '1v1' THEN 1 ELSE 2 END)
       OR (v_team = 2 AND v_t2 >= CASE WHEN v_match.format = '1v1' THEN 1 ELSE 2 END) THEN
      v_team := CASE WHEN v_team = 1 THEN 2 ELSE 1 END;
    END IF;
  END IF;

  INSERT INTO public.open_match_players (match_id, user_id, team, status)
  VALUES (p_match_id, v_uid, v_team, v_status)
  ON CONFLICT (match_id, user_id) DO UPDATE
    SET status = EXCLUDED.status,
        team = EXCLUDED.team
  WHERE public.open_match_players.status = 'rejected';

  IF v_status = 'confirmed' THEN
    PERFORM public.refresh_open_match_status(p_match_id);
  END IF;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.create_open_match(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_open_match(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.join_open_match(UUID, TEXT, SMALLINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_match(UUID, TEXT, SMALLINT) TO authenticated;
