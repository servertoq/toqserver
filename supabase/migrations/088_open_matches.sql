-- =============================================================================
-- Partidas abertas (1v1 / 2v2) — criar, buscar, senha opcional, aceite
-- Idempotente. Extensão pgcrypto já existe (crypt/bf).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.open_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number    BIGSERIAL UNIQUE NOT NULL,
  created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  format          TEXT NOT NULL CHECK (format IN ('1v1', '2v2')),
  capacity        SMALLINT NOT NULL CHECK (capacity IN (2, 4)),
  skill_level     NUMERIC(2,1) NOT NULL
                    CHECK (skill_level >= 0 AND skill_level <= 5),
  court_name      TEXT NOT NULL CHECK (char_length(trim(court_name)) BETWEEN 1 AND 80),
  city            TEXT NOT NULL DEFAULT '' CHECK (char_length(city) <= 80),
  community_id    UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  password_hash   TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'full', 'cancelled', 'done')),
  notes           TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 280),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT open_matches_format_capacity CHECK (
    (format = '1v1' AND capacity = 2) OR (format = '2v2' AND capacity = 4)
  )
);

CREATE INDEX IF NOT EXISTS open_matches_status_starts_idx
  ON public.open_matches (status, starts_at);
CREATE INDEX IF NOT EXISTS open_matches_created_by_idx
  ON public.open_matches (created_by);
CREATE INDEX IF NOT EXISTS open_matches_city_idx
  ON public.open_matches (lower(city));
CREATE INDEX IF NOT EXISTS open_matches_community_idx
  ON public.open_matches (community_id)
  WHERE community_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_open_matches_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS open_matches_updated_at ON public.open_matches;
CREATE TRIGGER open_matches_updated_at
  BEFORE UPDATE ON public.open_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_open_matches_updated_at();

CREATE TABLE IF NOT EXISTS public.open_match_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES public.open_matches(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team        SMALLINT NOT NULL CHECK (team IN (1, 2)),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('confirmed', 'pending', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS open_match_players_match_idx
  ON public.open_match_players (match_id, status);
CREATE INDEX IF NOT EXISTS open_match_players_user_idx
  ON public.open_match_players (user_id);

ALTER TABLE public.open_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_match_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partidas abertas visíveis" ON public.open_matches;
CREATE POLICY "Partidas abertas visíveis"
  ON public.open_matches FOR SELECT TO authenticated
  USING (status <> 'cancelled' OR created_by = auth.uid());

DROP POLICY IF EXISTS "Criador atualiza partida" ON public.open_matches;
CREATE POLICY "Criador atualiza partida"
  ON public.open_matches FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Jogadores da partida visíveis" ON public.open_match_players;
CREATE POLICY "Jogadores da partida visíveis"
  ON public.open_match_players FOR SELECT TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_match_confirmed_count(p_match_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.open_match_players
  WHERE match_id = p_match_id AND status = 'confirmed';
$$;

CREATE OR REPLACE FUNCTION public.refresh_open_match_status(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap INTEGER;
  v_count INTEGER;
  v_status TEXT;
BEGIN
  SELECT capacity, status INTO v_cap, v_status
  FROM public.open_matches WHERE id = p_match_id;

  IF NOT FOUND OR v_status IN ('cancelled', 'done') THEN
    RETURN;
  END IF;

  v_count := public.open_match_confirmed_count(p_match_id);
  UPDATE public.open_matches
  SET status = CASE WHEN v_count >= v_cap THEN 'full' ELSE 'open' END
  WHERE id = p_match_id
    AND status IN ('open', 'full');
END;
$$;

-- -----------------------------------------------------------------------------
-- Criar partida
-- -----------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.create_open_match(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_open_match(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- Pedir / entrar na partida
-- -----------------------------------------------------------------------------
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

  -- Com senha: valida e entra direto (confirmed)
  IF v_match.password_hash IS NOT NULL THEN
    IF NULLIF(trim(coalesce(p_password, '')), '') IS NULL
       OR extensions.crypt(trim(p_password), v_match.password_hash) <> v_match.password_hash THEN
      RAISE EXCEPTION 'Senha incorreta';
    END IF;
    v_status := 'confirmed';
  ELSE
    -- Sem senha: pedido pendente, criador aceita
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
    -- 2v2: preenche time com menos confirmados (máx 2 por time)
    IF v_t1 < 2 AND (v_t1 <= v_t2 OR v_t2 >= 2) THEN
      v_team := 1;
    ELSE
      v_team := 2;
    END IF;
  END IF;

  IF v_status = 'confirmed' THEN
    IF (v_team = 1 AND v_t1 >= CASE WHEN v_match.format = '1v1' THEN 1 ELSE 2 END)
       OR (v_team = 2 AND v_t2 >= CASE WHEN v_match.format = '1v1' THEN 1 ELSE 2 END) THEN
      -- tenta o outro time
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

REVOKE ALL ON FUNCTION public.join_open_match(UUID, TEXT, SMALLINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_match(UUID, TEXT, SMALLINT) TO authenticated;

-- -----------------------------------------------------------------------------
-- Aceitar / recusar pedido
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_open_match_join(
  p_match_id UUID,
  p_user_id UUID,
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
  IF NOT FOUND OR v_match.created_by <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.open_match_players
  WHERE match_id = p_match_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.open_match_players
    SET status = 'rejected'
    WHERE id = v_row.id;
    RETURN;
  END IF;

  IF public.open_match_confirmed_count(p_match_id) >= v_match.capacity THEN
    RAISE EXCEPTION 'Partida lotada';
  END IF;

  UPDATE public.open_match_players
  SET status = 'confirmed'
  WHERE id = v_row.id;

  PERFORM public.refresh_open_match_status(p_match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_open_match_join(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_open_match_join(UUID, UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_open_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.open_matches
  SET status = 'cancelled'
  WHERE id = p_match_id AND created_by = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada ou sem permissão';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_open_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_open_match(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Busca / listagem
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_open_matches(
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 40
)
RETURNS TABLE (
  id UUID,
  match_number BIGINT,
  created_by UUID,
  format TEXT,
  capacity SMALLINT,
  skill_level NUMERIC,
  court_name TEXT,
  city TEXT,
  community_id UUID,
  community_name TEXT,
  has_password BOOLEAN,
  starts_at TIMESTAMPTZ,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  confirmed_count INTEGER,
  pending_count INTEGER,
  creator_username TEXT,
  creator_display_name TEXT,
  creator_avatar_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q TEXT := lower(trim(coalesce(p_query, '')));
  v_num BIGINT;
BEGIN
  IF v_q ~ '^[0-9]+$' THEN
    v_num := v_q::BIGINT;
  ELSE
    v_num := NULL;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.match_number,
    m.created_by,
    m.format,
    m.capacity,
    m.skill_level,
    m.court_name,
    m.city,
    m.community_id,
    c.name,
    (m.password_hash IS NOT NULL),
    m.starts_at,
    m.status,
    m.notes,
    m.created_at,
    (
      SELECT COUNT(*)::INTEGER FROM public.open_match_players p
      WHERE p.match_id = m.id AND p.status = 'confirmed'
    ),
    (
      SELECT COUNT(*)::INTEGER FROM public.open_match_players p
      WHERE p.match_id = m.id AND p.status = 'pending'
    ),
    pr.username,
    pr.display_name,
    pr.avatar_url
  FROM public.open_matches m
  JOIN public.profiles pr ON pr.id = m.created_by
  LEFT JOIN public.communities c ON c.id = m.community_id
  WHERE m.status IN ('open', 'full')
    AND m.starts_at >= (now() - INTERVAL '6 hours')
    AND (
      v_q = ''
      OR m.match_number = v_num
      OR m.created_by::TEXT ILIKE v_q || '%'
      OR lower(pr.username) LIKE '%' || v_q || '%'
      OR lower(coalesce(pr.display_name, '')) LIKE '%' || v_q || '%'
      OR lower(m.city) LIKE '%' || v_q || '%'
      OR lower(m.court_name) LIKE '%' || v_q || '%'
      OR lower(coalesce(c.name, '')) LIKE '%' || v_q || '%'
    )
  ORDER BY
    CASE WHEN m.status = 'open' THEN 0 ELSE 1 END,
    m.starts_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 40), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.search_open_matches(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_open_matches(TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_open_match_detail(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match JSONB;
  v_players JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', m.id,
    'match_number', m.match_number,
    'created_by', m.created_by,
    'format', m.format,
    'capacity', m.capacity,
    'skill_level', m.skill_level,
    'court_name', m.court_name,
    'city', m.city,
    'community_id', m.community_id,
    'community_name', c.name,
    'has_password', m.password_hash IS NOT NULL,
    'starts_at', m.starts_at,
    'status', m.status,
    'notes', m.notes,
    'created_at', m.created_at,
    'creator_username', pr.username,
    'creator_display_name', pr.display_name,
    'creator_avatar_url', pr.avatar_url
  )
  INTO v_match
  FROM public.open_matches m
  JOIN public.profiles pr ON pr.id = m.created_by
  LEFT JOIN public.communities c ON c.id = m.community_id
  WHERE m.id = p_match_id;

  IF v_match IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', p.user_id,
      'team', p.team,
      'status', p.status,
      'username', u.username,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'created_at', p.created_at
    )
    ORDER BY p.team, p.created_at
  ), '[]'::jsonb)
  INTO v_players
  FROM public.open_match_players p
  JOIN public.profiles u ON u.id = p.user_id
  WHERE p.match_id = p_match_id
    AND p.status IN ('confirmed', 'pending');

  RETURN v_match || jsonb_build_object('players', v_players);
END;
$$;

REVOKE ALL ON FUNCTION public.get_open_match_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_open_match_detail(UUID) TO authenticated;
