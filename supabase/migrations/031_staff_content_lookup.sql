-- =============================================================================
-- Toq Tennis — Staff: listar conteúdo por usuário e buscar recursos por nome
-- =============================================================================

CREATE OR REPLACE FUNCTION public.staff_list_user_posts(
  p_user_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  body TEXT,
  title TEXT,
  post_type TEXT,
  community_id UUID,
  community_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  RETURN QUERY
  SELECT
    p.id,
    p.body,
    p.title,
    p.post_type::TEXT,
    p.community_id,
    c.name AS community_name,
    p.created_at
  FROM public.posts p
  LEFT JOIN public.communities c ON c.id = p.community_id
  WHERE p.author_id = p_user_id
    AND (p_date_from IS NULL OR p.created_at::DATE >= p_date_from)
    AND (p_date_to IS NULL OR p.created_at::DATE <= p_date_to)
  ORDER BY p.created_at DESC
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_list_user_comments(
  p_user_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  body TEXT,
  post_id UUID,
  post_body_preview TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  RETURN QUERY
  SELECT
    pc.id,
    pc.body,
    pc.post_id,
    LEFT(p.body, 120) AS post_body_preview,
    pc.created_at
  FROM public.post_comments pc
  JOIN public.posts p ON p.id = pc.post_id
  WHERE pc.author_id = p_user_id
    AND (p_date_from IS NULL OR pc.created_at::DATE >= p_date_from)
    AND (p_date_to IS NULL OR pc.created_at::DATE <= p_date_to)
  ORDER BY pc.created_at DESC
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_search_communities(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  member_count INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.member_count,
    c.created_at
  FROM public.communities c
  WHERE LENGTH(TRIM(p_query)) >= 2
    AND (
      c.name ILIKE '%' || TRIM(p_query) || '%'
      OR c.slug ILIKE '%' || TRIM(p_query) || '%'
    )
  ORDER BY c.name
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_search_courts(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  city TEXT,
  state CHAR(2),
  owner_username TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.city,
    ct.state,
    pr.username AS owner_username,
    ct.created_at
  FROM public.courts ct
  JOIN public.profiles pr ON pr.id = ct.owner_id
  WHERE LENGTH(TRIM(p_query)) >= 2
    AND ct.name ILIKE '%' || TRIM(p_query) || '%'
  ORDER BY ct.name
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_search_club_courts(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  community_name TEXT,
  community_slug TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  RETURN QUERY
  SELECT
    cc.id,
    cc.name,
    c.name AS community_name,
    c.slug AS community_slug,
    cc.created_at
  FROM public.club_courts cc
  JOIN public.communities c ON c.id = cc.community_id
  WHERE LENGTH(TRIM(p_query)) >= 2
    AND cc.name ILIKE '%' || TRIM(p_query) || '%'
  ORDER BY cc.name
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_search_tournaments(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  community_name TEXT,
  community_slug TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    c.name AS community_name,
    c.slug AS community_slug,
    t.created_at
  FROM public.club_tournaments t
  JOIN public.communities c ON c.id = t.community_id
  WHERE LENGTH(TRIM(p_query)) >= 2
    AND t.name ILIKE '%' || TRIM(p_query) || '%'
  ORDER BY t.name
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_user_posts(UUID, DATE, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_list_user_comments(UUID, DATE, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_search_communities(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_search_courts(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_search_club_courts(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_search_tournaments(TEXT, INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.staff_list_user_posts(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_user_comments(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_search_communities(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_search_courts(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_search_club_courts(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_search_tournaments(TEXT, INT) TO authenticated;
