-- =============================================================================
-- Convite para partida aberta (criador busca usuário e convida)
-- =============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS open_match_id UUID REFERENCES public.open_matches(id) ON DELETE CASCADE;

-- Status invited no jogador
DO $$
BEGIN
  ALTER TABLE public.open_match_players DROP CONSTRAINT IF EXISTS open_match_players_status_check;
EXCEPTION WHEN others THEN
  NULL;
END $$;

ALTER TABLE public.open_match_players
  DROP CONSTRAINT IF EXISTS open_match_players_status_check;

ALTER TABLE public.open_match_players
  ADD CONSTRAINT open_match_players_status_check
  CHECK (status IN ('confirmed', 'pending', 'rejected', 'invited'));

-- Busca por username ou id (parcial / uuid completo)
CREATE OR REPLACE FUNCTION public.search_profiles_for_open_match(
  p_query TEXT,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(trim(both FROM coalesce(p_query, ''))) AS raw,
           trim(both FROM coalesce(p_query, '')) AS raw_trim
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p, q
  WHERE length(q.raw) >= 1
    AND p.id <> auth.uid()
    AND (
      p.username ILIKE '%' || q.raw_trim || '%'
      OR lower(coalesce(p.display_name, '')) LIKE '%' || q.raw || '%'
      OR p.id::text ILIKE q.raw_trim || '%'
      OR (
        q.raw_trim ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND p.id = q.raw_trim::uuid
      )
    )
  ORDER BY
    CASE WHEN lower(p.username) = q.raw THEN 0
         WHEN p.username ILIKE q.raw_trim || '%' THEN 1
         ELSE 2 END,
    p.username
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 20));
$$;

REVOKE ALL ON FUNCTION public.search_profiles_for_open_match(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles_for_open_match(TEXT, INTEGER) TO authenticated;

-- Criador convida
CREATE OR REPLACE FUNCTION public.invite_to_open_match(
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
  v_existing TEXT;
  v_team SMALLINT := 1;
  v_t1 INTEGER;
  v_t2 INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_user_id = v_uid THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  SELECT * INTO v_match FROM public.open_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.created_by <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('cancelled', 'done') THEN
    RAISE EXCEPTION 'Partida indisponível';
  END IF;

  IF public.open_match_confirmed_count(p_match_id) >= v_match.capacity THEN
    RAISE EXCEPTION 'Partida lotada';
  END IF;

  SELECT status INTO v_existing
  FROM public.open_match_players
  WHERE match_id = p_match_id AND user_id = p_user_id;

  IF v_existing = 'confirmed' THEN
    RAISE EXCEPTION 'Este usuário já está na partida';
  END IF;
  IF v_existing = 'pending' THEN
    RAISE EXCEPTION 'Este usuário já pediu para entrar';
  END IF;
  IF v_existing = 'invited' THEN
    RETURN;
  END IF;

  IF v_match.format = 'club' THEN
    v_team := 1;
  ELSIF v_match.format = '1v1' THEN
    v_team := 2;
  ELSE
    SELECT COUNT(*)::INTEGER INTO v_t1
    FROM public.open_match_players
    WHERE match_id = p_match_id AND status = 'confirmed' AND team = 1;
    SELECT COUNT(*)::INTEGER INTO v_t2
    FROM public.open_match_players
    WHERE match_id = p_match_id AND status = 'confirmed' AND team = 2;
    IF v_t1 < 2 AND (v_t1 <= v_t2 OR v_t2 >= 2) THEN
      v_team := 1;
    ELSE
      v_team := 2;
    END IF;
  END IF;

  INSERT INTO public.open_match_players (match_id, user_id, team, status, day_use_accepted)
  VALUES (p_match_id, p_user_id, v_team, 'invited', false)
  ON CONFLICT (match_id, user_id) DO UPDATE
    SET status = 'invited',
        team = EXCLUDED.team
  WHERE public.open_match_players.status = 'rejected';

  INSERT INTO public.notifications (
    recipient_id, actor_id, type, open_match_id, community_id
  ) VALUES (
    p_user_id,
    v_uid,
    'open_match_invite'::public.notification_type,
    p_match_id,
    v_match.community_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invite_to_open_match(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_to_open_match(UUID, UUID) TO authenticated;

-- Convidado aceita / recusa
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

  UPDATE public.open_match_players
  SET status = 'confirmed'
  WHERE id = v_row.id;

  PERFORM public.refresh_open_match_status(p_match_id);

  UPDATE public.notifications
  SET read_at = coalesce(read_at, now())
  WHERE recipient_id = v_uid
    AND open_match_id = p_match_id
    AND type = 'open_match_invite'::public.notification_type
    AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_open_match_invite(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_open_match_invite(UUID, BOOLEAN) TO authenticated;

-- Detail inclui convidados
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
  v_uid UUID := auth.uid();
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
    'community_cover_url', c.cover_image_url,
    'community_city', c.address_city,
    'community_state', c.address_state,
    'post_id', m.post_id,
    'has_password', m.password_hash IS NOT NULL,
    'starts_at', m.starts_at,
    'status', m.status,
    'notes', m.notes,
    'created_at', m.created_at,
    'creator_username', pr.username,
    'creator_display_name', pr.display_name,
    'creator_avatar_url', pr.avatar_url,
    'viewer_is_member', CASE
      WHEN m.community_id IS NULL THEN false
      ELSE public.is_community_member(m.community_id, v_uid)
    END,
    'day_use_allow_outsiders', coalesce(c.day_use_allow_outsiders, true),
    'day_use_price', coalesce(c.day_use_price, 0)
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
      'day_use_accepted', p.day_use_accepted,
      'username', u.username,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'created_at', p.created_at
    )
    ORDER BY
      CASE p.status
        WHEN 'confirmed' THEN 0
        WHEN 'invited' THEN 1
        WHEN 'pending' THEN 2
        ELSE 3
      END,
      p.team,
      p.created_at
  ), '[]'::jsonb)
  INTO v_players
  FROM public.open_match_players p
  JOIN public.profiles u ON u.id = p.user_id
  WHERE p.match_id = p_match_id
    AND p.status IN ('confirmed', 'pending', 'invited');

  RETURN v_match || jsonb_build_object('players', v_players);
END;
$$;

REVOKE ALL ON FUNCTION public.get_open_match_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_open_match_detail(UUID) TO authenticated;

-- Cancel também notifica convidados
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

  FOR r IN
    SELECT DISTINCT p.user_id
    FROM public.open_match_players p
    WHERE p.match_id = p_match_id
      AND p.user_id <> v_uid
      AND p.status IN ('confirmed', 'pending', 'invited')
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

-- Convidados devem ver a partida mesmo com day use bloqueado
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
  community_cover_url TEXT,
  community_city TEXT,
  community_state TEXT,
  post_id UUID,
  has_password BOOLEAN,
  starts_at TIMESTAMPTZ,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  confirmed_count INTEGER,
  pending_count INTEGER,
  creator_username TEXT,
  creator_display_name TEXT,
  creator_avatar_url TEXT,
  viewer_is_member BOOLEAN,
  day_use_allow_outsiders BOOLEAN,
  day_use_price NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q TEXT := lower(trim(coalesce(p_query, '')));
  v_num BIGINT;
  v_uid UUID := auth.uid();
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
    c.cover_image_url,
    c.address_city,
    c.address_state,
    m.post_id,
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
    pr.avatar_url,
    CASE
      WHEN m.community_id IS NULL THEN false
      ELSE public.is_community_member(m.community_id, v_uid)
    END,
    coalesce(c.day_use_allow_outsiders, true),
    coalesce(c.day_use_price, 0)
  FROM public.open_matches m
  JOIN public.profiles pr ON pr.id = m.created_by
  LEFT JOIN public.communities c ON c.id = m.community_id
  WHERE m.status IN ('open', 'full')
    AND m.starts_at >= (now() - INTERVAL '6 hours')
    AND (
      m.community_id IS NULL
      OR public.is_community_member(m.community_id, v_uid)
      OR coalesce(c.day_use_allow_outsiders, true)
      OR EXISTS (
        SELECT 1 FROM public.open_match_players mp
        WHERE mp.match_id = m.id
          AND mp.user_id = v_uid
          AND mp.status IN ('confirmed', 'pending', 'invited')
      )
    )
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
    CASE WHEN m.community_id IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN m.status = 'open' THEN 0 ELSE 1 END,
    m.starts_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 40), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.search_open_matches(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_open_matches(TEXT, INTEGER) TO authenticated;
