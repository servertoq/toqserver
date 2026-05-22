-- =============================================================================
-- Toq Tennis — Estatísticas públicas de perfil e busca de jogadores
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_profile_public_stats(p_profile_id UUID)
RETURNS TABLE(post_count BIGINT, friend_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.posts WHERE author_id = p_profile_id),
    (SELECT COUNT(*)::BIGINT FROM public.friendships WHERE user_id = p_profile_id);
$$;

REVOKE ALL ON FUNCTION public.get_profile_public_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_public_stats(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_by_username(p_username TEXT)
RETURNS TABLE(
  id UUID,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  birth_date DATE,
  gender public.gender_type,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.avatar_url, p.bio, p.birth_date, p.gender, p.created_at
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(TRIM(p_username))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(TEXT) TO authenticated;
