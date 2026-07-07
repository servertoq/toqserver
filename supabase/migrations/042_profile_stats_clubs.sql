-- Estatísticas públicas: incluir clubes em que o jogador participa

CREATE OR REPLACE FUNCTION public.get_profile_public_stats(p_profile_id UUID)
RETURNS TABLE(post_count BIGINT, friend_count BIGINT, club_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.posts WHERE author_id = p_profile_id),
    (SELECT COUNT(*)::BIGINT FROM public.friendships WHERE user_id = p_profile_id),
    (
      SELECT COUNT(*)::BIGINT
      FROM public.community_members cm
      INNER JOIN public.communities c ON c.id = cm.community_id
      WHERE cm.user_id = p_profile_id
        AND c.kind = 'club'::public.community_kind
    );
$$;

REVOKE ALL ON FUNCTION public.get_profile_public_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_public_stats(UUID) TO authenticated;
