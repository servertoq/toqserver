-- Nome do clube (partida livre) + tipo de piso da quadra

ALTER TABLE public.open_matches
  ADD COLUMN IF NOT EXISTS club_name TEXT NOT NULL DEFAULT ''
    CHECK (char_length(club_name) <= 80);

ALTER TABLE public.open_matches
  ADD COLUMN IF NOT EXISTS court_surface TEXT NOT NULL DEFAULT ''
    CHECK (
      court_surface = ''
      OR court_surface IN ('saibro', 'hard', 'grama', 'indoor')
    );

COMMENT ON COLUMN public.open_matches.club_name IS
  'Nome do clube/local (partida livre; em partidas vinculadas usa communities.name).';
COMMENT ON COLUMN public.open_matches.court_surface IS
  'Tipo de piso: saibro, hard, grama, indoor (vazio = não informado).';

-- create_open_match: club_name + court_surface
DROP FUNCTION IF EXISTS public.create_open_match(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.create_open_match(
  p_format TEXT,
  p_skill_level NUMERIC,
  p_court_name TEXT,
  p_city TEXT,
  p_starts_at TIMESTAMPTZ,
  p_password TEXT DEFAULT NULL,
  p_community_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT '',
  p_club_name TEXT DEFAULT '',
  p_court_surface TEXT DEFAULT ''
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
  v_format TEXT := p_format;
  v_surface TEXT := lower(trim(coalesce(p_court_surface, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_community_id IS NOT NULL THEN
    IF NOT public.is_community_member(p_community_id, v_uid) THEN
      RAISE EXCEPTION 'Só membros do clube podem criar partida vinculada';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = p_community_id AND kind = 'club'
    ) THEN
      RAISE EXCEPTION 'Partida vinculada só em clube';
    END IF;
    v_format := 'club';
    v_cap := CASE
      WHEN p_format = '1v1' THEN 2
      WHEN p_format = '2v2' THEN 4
      ELSE 4
    END;
  ELSE
    IF p_format NOT IN ('1v1', '2v2') THEN
      RAISE EXCEPTION 'Formato inválido';
    END IF;
    v_cap := CASE WHEN p_format = '1v1' THEN 2 ELSE 4 END;
  END IF;

  IF p_skill_level IS NULL OR p_skill_level < 0 OR p_skill_level > 5 THEN
    RAISE EXCEPTION 'Nível deve ser entre 0 e 5';
  END IF;

  IF NULLIF(trim(p_court_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da quadra';
  END IF;

  IF v_surface <> '' AND v_surface NOT IN ('saibro', 'hard', 'grama', 'indoor') THEN
    RAISE EXCEPTION 'Tipo de quadra inválido';
  END IF;

  IF p_starts_at IS NULL OR p_starts_at < (now() - INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Data/hora da partida inválida';
  END IF;

  v_hash := CASE
    WHEN NULLIF(trim(p_password), '') IS NULL THEN NULL
    ELSE extensions.crypt(trim(p_password), extensions.gen_salt('bf'))
  END;

  INSERT INTO public.open_matches (
    created_by, format, capacity, skill_level, court_name, city,
    community_id, password_hash, starts_at, notes, club_name, court_surface
  ) VALUES (
    v_uid,
    v_format,
    v_cap,
    round(p_skill_level::numeric, 1),
    trim(p_court_name),
    coalesce(trim(p_city), ''),
    p_community_id,
    v_hash,
    p_starts_at,
    left(coalesce(trim(p_notes), ''), 280),
    left(coalesce(trim(p_club_name), ''), 80),
    v_surface
  )
  RETURNING id INTO v_id;

  INSERT INTO public.open_match_players (match_id, user_id, team, status)
  VALUES (v_id, v_uid, 1, 'confirmed');

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_open_match(
  TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_open_match(
  TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT, TEXT
) TO authenticated;

-- search_open_matches: retorna club_name + court_surface
DROP FUNCTION IF EXISTS public.search_open_matches(TEXT, INTEGER);

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
  day_use_price NUMERIC,
  club_name TEXT,
  court_surface TEXT
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
    m.match_number::BIGINT,
    m.created_by,
    m.format::TEXT,
    m.capacity::SMALLINT,
    m.skill_level::NUMERIC,
    m.court_name::TEXT,
    m.city::TEXT,
    m.community_id,
    c.name::TEXT,
    c.cover_image_url::TEXT,
    c.address_city::TEXT,
    c.address_state::TEXT,
    m.post_id,
    (m.password_hash IS NOT NULL)::BOOLEAN,
    m.starts_at,
    m.status::TEXT,
    m.notes::TEXT,
    m.created_at,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.open_match_players p
      WHERE p.match_id = m.id AND p.status = 'confirmed'
    ),
    (
      SELECT COUNT(*)::INTEGER
      FROM public.open_match_players p
      WHERE p.match_id = m.id AND p.status = 'pending'
    ),
    pr.username::TEXT,
    pr.display_name::TEXT,
    pr.avatar_url::TEXT,
    (
      CASE
        WHEN m.community_id IS NULL THEN false
        ELSE public.is_community_member(m.community_id, v_uid)
      END
    )::BOOLEAN,
    coalesce(c.day_use_allow_outsiders, true)::BOOLEAN,
    coalesce(c.day_use_price, 0)::NUMERIC,
    coalesce(m.club_name, '')::TEXT,
    coalesce(m.court_surface, '')::TEXT
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
      OR lower(coalesce(m.club_name, '')) LIKE '%' || v_q || '%'
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

-- get_open_match_detail: inclui club_name + court_surface
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
    'club_name', coalesce(m.club_name, ''),
    'court_surface', coalesce(m.court_surface, ''),
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
    ORDER BY p.team, p.created_at
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
