-- Sugestões de amizade (amigos em comum) para a barra lateral do feed

CREATE OR REPLACE FUNCTION public.get_friend_suggestions(
  p_limit INT DEFAULT 4,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  profile_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  mutual_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_friends AS (
    SELECT friend_id AS id
    FROM public.friendships
    WHERE user_id = auth.uid()
  ),
  pending AS (
    SELECT addressee_id AS id
    FROM public.friend_requests
    WHERE requester_id = auth.uid() AND status = 'pending'
    UNION
    SELECT requester_id AS id
    FROM public.friend_requests
    WHERE addressee_id = auth.uid() AND status = 'pending'
  ),
  candidates AS (
    SELECT f2.friend_id AS profile_id, COUNT(DISTINCT mf.id) AS mutual_count
    FROM my_friends mf
    INNER JOIN public.friendships f2 ON f2.user_id = mf.id
    WHERE f2.friend_id <> auth.uid()
      AND f2.friend_id NOT IN (SELECT id FROM my_friends)
      AND f2.friend_id NOT IN (SELECT id FROM pending)
    GROUP BY f2.friend_id
  )
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    c.mutual_count
  FROM candidates c
  INNER JOIN public.profiles p ON p.id = c.profile_id
  ORDER BY c.mutual_count DESC, p.username
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.get_friend_suggestions(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_friend_suggestions(INT, INT) TO authenticated;
