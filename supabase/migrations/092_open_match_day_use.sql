-- =============================================================================
-- Day Use: config no clube + partidas do post aparecem em open_matches
-- =============================================================================

-- Config Day Use no clube
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS day_use_allow_outsiders BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS day_use_price NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (day_use_price >= 0);

COMMENT ON COLUMN public.communities.day_use_allow_outsiders IS
  'Se false, partidas do clube só aparecem/podem ser pedidas por membros.';
COMMENT ON COLUMN public.communities.day_use_price IS
  'Valor do Day Use (0 = gratuito). Cobrado de não-membros ao pedir participação.';

-- Ligação post ↔ open_match
ALTER TABLE public.open_matches
  ADD COLUMN IF NOT EXISTS post_id UUID UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.open_match_players
  ADD COLUMN IF NOT EXISTS day_use_accepted BOOLEAN NOT NULL DEFAULT false;

-- Formato club (capacidade flexível 1–64)
DO $$
BEGIN
  ALTER TABLE public.open_matches DROP CONSTRAINT IF EXISTS open_matches_format_capacity;
  ALTER TABLE public.open_matches DROP CONSTRAINT IF EXISTS open_matches_format_check;
  ALTER TABLE public.open_matches DROP CONSTRAINT IF EXISTS open_matches_capacity_check;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Remove CHECK embutido na coluna se ainda existir (recria coluna constraints via table)
ALTER TABLE public.open_matches
  ALTER COLUMN format TYPE TEXT,
  ALTER COLUMN capacity TYPE SMALLINT;

ALTER TABLE public.open_matches
  ADD CONSTRAINT open_matches_format_check
  CHECK (format IN ('1v1', '2v2', 'club'));

ALTER TABLE public.open_matches
  ADD CONSTRAINT open_matches_capacity_check
  CHECK (capacity >= 1 AND capacity <= 64);

ALTER TABLE public.open_matches
  ADD CONSTRAINT open_matches_format_capacity CHECK (
    (format = '1v1' AND capacity = 2)
    OR (format = '2v2' AND capacity = 4)
    OR (format = 'club' AND community_id IS NOT NULL AND capacity BETWEEN 1 AND 64)
  );

-- -----------------------------------------------------------------------------
-- Sync: post partida no clube → open_match
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_open_match_from_post_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.posts%ROWTYPE;
  v_club public.communities%ROWTYPE;
  v_starts TIMESTAMPTZ;
  v_city TEXT;
  v_court TEXT;
  v_id UUID;
  v_format TEXT;
BEGIN
  SELECT * INTO v_post FROM public.posts WHERE id = NEW.post_id;
  IF NOT FOUND OR v_post.post_type IS DISTINCT FROM 'partida'::public.post_type THEN
    RETURN NEW;
  END IF;

  IF v_post.community_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_club FROM public.communities WHERE id = v_post.community_id;
  IF NOT FOUND OR v_club.kind IS DISTINCT FROM 'club'::public.community_kind THEN
    RETURN NEW;
  END IF;

  IF v_post.event_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_starts := (v_post.event_date + coalesce(v_post.event_time, time '12:00'))
    AT TIME ZONE 'America/Sao_Paulo';

  v_city := trim(both ' —' FROM concat_ws(
    ' — ',
    nullif(trim(coalesce(v_club.address_city, '')), ''),
    nullif(upper(trim(coalesce(v_club.address_state, ''))), '')
  ));

  v_court := coalesce(nullif(trim(v_post.title), ''), 'Quadra do clube');
  v_format := 'club';

  INSERT INTO public.open_matches (
    created_by, format, capacity, skill_level, court_name, city,
    community_id, post_id, starts_at, notes, status
  ) VALUES (
    v_post.author_id,
    v_format,
    NEW.capacity,
    3.0,
    left(v_court, 80),
    left(coalesce(v_city, ''), 80),
    v_post.community_id,
    v_post.id,
    v_starts,
    left(coalesce(trim(v_post.body), ''), 280),
    'open'
  )
  ON CONFLICT (post_id) DO UPDATE
    SET capacity = EXCLUDED.capacity,
        court_name = EXCLUDED.court_name,
        city = EXCLUDED.city,
        starts_at = EXCLUDED.starts_at,
        notes = EXCLUDED.notes,
        updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.open_match_players (match_id, user_id, team, status)
  VALUES (v_id, v_post.author_id, 1, 'confirmed')
  ON CONFLICT (match_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_open_match_from_post_match ON public.post_matches;
CREATE TRIGGER trg_sync_open_match_from_post_match
  AFTER INSERT OR UPDATE OF capacity ON public.post_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_open_match_from_post_match();

-- Atualiza open_match quando data/hora/título do post muda
CREATE OR REPLACE FUNCTION public.sync_open_match_from_post_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starts TIMESTAMPTZ;
  v_court TEXT;
  v_club public.communities%ROWTYPE;
  v_city TEXT;
BEGIN
  IF NEW.post_type IS DISTINCT FROM 'partida'::public.post_type THEN
    RETURN NEW;
  END IF;

  IF NEW.event_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_starts := (NEW.event_date + coalesce(NEW.event_time, time '12:00'))
    AT TIME ZONE 'America/Sao_Paulo';
  v_court := coalesce(nullif(trim(NEW.title), ''), 'Quadra do clube');

  IF NEW.community_id IS NOT NULL THEN
    SELECT * INTO v_club FROM public.communities WHERE id = NEW.community_id;
    v_city := trim(both ' —' FROM concat_ws(
      ' — ',
      nullif(trim(coalesce(v_club.address_city, '')), ''),
      nullif(upper(trim(coalesce(v_club.address_state, ''))), '')
    ));
  END IF;

  UPDATE public.open_matches
  SET
    starts_at = v_starts,
    court_name = left(v_court, 80),
    city = left(coalesce(v_city, city), 80),
    notes = left(coalesce(trim(NEW.body), ''), 280),
    updated_at = now()
  WHERE post_id = NEW.id
    AND status IN ('open', 'full');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_open_match_from_post_update ON public.posts;
CREATE TRIGGER trg_sync_open_match_from_post_update
  AFTER UPDATE OF title, body, event_date, event_time, community_id
  ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_open_match_from_post_update();

-- -----------------------------------------------------------------------------
-- Join com Day Use
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_open_match(
  p_match_id UUID,
  p_password TEXT DEFAULT NULL,
  p_team SMALLINT DEFAULT NULL,
  p_day_use_accepted BOOLEAN DEFAULT false
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
  v_is_member BOOLEAN := false;
  v_allow_outsiders BOOLEAN := true;
  v_day_use BOOLEAN := false;
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

  -- Partida vinculada a clube
  IF v_match.community_id IS NOT NULL THEN
    v_is_member := public.is_community_member(v_match.community_id, v_uid);
    SELECT day_use_allow_outsiders INTO v_allow_outsiders
    FROM public.communities WHERE id = v_match.community_id;

    IF NOT v_is_member THEN
      IF NOT coalesce(v_allow_outsiders, false) THEN
        RAISE EXCEPTION 'Esta partida é exclusiva para membros do clube';
      END IF;
      IF NOT coalesce(p_day_use_accepted, false) THEN
        RAISE EXCEPTION 'Aceite as políticas de Day Use para participar';
      END IF;
      v_day_use := true;
      v_status := 'pending';
    ELSE
      -- Membro: senha (se houver) ou pedido
      IF v_match.password_hash IS NOT NULL THEN
        IF NULLIF(trim(coalesce(p_password, '')), '') IS NULL
           OR extensions.crypt(trim(p_password), v_match.password_hash) <> v_match.password_hash THEN
          RAISE EXCEPTION 'Senha incorreta';
        END IF;
        v_status := 'confirmed';
      ELSE
        v_status := 'pending';
      END IF;
    END IF;
  ELSE
    -- Partida avulsa
    IF v_match.password_hash IS NOT NULL THEN
      IF NULLIF(trim(coalesce(p_password, '')), '') IS NULL
         OR extensions.crypt(trim(p_password), v_match.password_hash) <> v_match.password_hash THEN
        RAISE EXCEPTION 'Senha incorreta';
      END IF;
      v_status := 'confirmed';
    ELSE
      v_status := 'pending';
    END IF;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_t1
  FROM public.open_match_players
  WHERE match_id = p_match_id AND status = 'confirmed' AND team = 1;
  SELECT COUNT(*)::INTEGER INTO v_t2
  FROM public.open_match_players
  WHERE match_id = p_match_id AND status = 'confirmed' AND team = 2;

  IF v_match.format = 'club' THEN
    v_team := 1;
  ELSIF p_team IN (1, 2) THEN
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

  IF v_status = 'confirmed' AND v_match.format <> 'club' THEN
    IF (v_team = 1 AND v_t1 >= CASE WHEN v_match.format = '1v1' THEN 1 ELSE 2 END)
       OR (v_team = 2 AND v_t2 >= CASE WHEN v_match.format = '1v1' THEN 1 ELSE 2 END) THEN
      v_team := CASE WHEN v_team = 1 THEN 2 ELSE 1 END;
    END IF;
  END IF;

  INSERT INTO public.open_match_players (match_id, user_id, team, status, day_use_accepted)
  VALUES (p_match_id, v_uid, v_team, v_status, v_day_use)
  ON CONFLICT (match_id, user_id) DO UPDATE
    SET status = EXCLUDED.status,
        team = EXCLUDED.team,
        day_use_accepted = EXCLUDED.day_use_accepted
  WHERE public.open_match_players.status = 'rejected';

  IF v_status = 'confirmed' THEN
    PERFORM public.refresh_open_match_status(p_match_id);
  END IF;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_match(UUID, TEXT, SMALLINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_open_match(UUID, TEXT, SMALLINT, BOOLEAN) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.join_open_match(UUID, TEXT, SMALLINT);
GRANT EXECUTE ON FUNCTION public.join_open_match(UUID, TEXT, SMALLINT, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------
-- Busca: filtra members_only + campos Day Use
-- -----------------------------------------------------------------------------
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

-- Detail enriquecido
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

-- create_open_match: permitir community_id + format club (sem post)
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
  v_format TEXT := p_format;
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

  IF p_starts_at IS NULL OR p_starts_at < (now() - INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Data/hora da partida inválida';
  END IF;

  v_hash := CASE
    WHEN NULLIF(trim(p_password), '') IS NULL THEN NULL
    ELSE extensions.crypt(trim(p_password), extensions.gen_salt('bf'))
  END;

  INSERT INTO public.open_matches (
    created_by, format, capacity, skill_level, court_name, city,
    community_id, password_hash, starts_at, notes
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

-- Backfill: partidas já publicadas no feed do clube
INSERT INTO public.open_matches (
  created_by, format, capacity, skill_level, court_name, city,
  community_id, post_id, starts_at, notes, status
)
SELECT
  p.author_id,
  'club',
  pm.capacity,
  3.0,
  left(coalesce(nullif(trim(p.title), ''), 'Quadra do clube'), 80),
  left(trim(both ' —' FROM concat_ws(
    ' — ',
    nullif(trim(coalesce(c.address_city, '')), ''),
    nullif(upper(trim(coalesce(c.address_state, ''))), '')
  )), 80),
  p.community_id,
  p.id,
  (p.event_date + coalesce(p.event_time, time '12:00')) AT TIME ZONE 'America/Sao_Paulo',
  left(coalesce(trim(p.body), ''), 280),
  'open'
FROM public.post_matches pm
JOIN public.posts p ON p.id = pm.post_id
JOIN public.communities c ON c.id = p.community_id
WHERE p.post_type = 'partida'::public.post_type
  AND c.kind = 'club'::public.community_kind
  AND p.event_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.open_matches om WHERE om.post_id = p.id
  );

INSERT INTO public.open_match_players (match_id, user_id, team, status)
SELECT m.id, m.created_by, 1, 'confirmed'
FROM public.open_matches m
WHERE m.post_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.open_match_players p
    WHERE p.match_id = m.id AND p.user_id = m.created_by
  );
