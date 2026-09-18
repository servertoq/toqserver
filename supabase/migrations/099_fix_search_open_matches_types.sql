-- Corrige: structure of query does not match function result type
-- (casts explícitos no RETURN QUERY de search_open_matches)

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
    coalesce(c.day_use_price, 0)::NUMERIC
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
