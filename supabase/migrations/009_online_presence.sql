-- =============================================================================
-- Toq Tennis — Presença online e amigos online
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at DESC)
  WHERE last_seen_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen_at = NOW()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.touch_presence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_online_friends()
RETURNS TABLE(
  friend_id UUID,
  username TEXT,
  avatar_url TEXT,
  last_seen_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.friend_id,
    p.username,
    p.avatar_url,
    p.last_seen_at
  FROM public.friendships f
  INNER JOIN public.profiles p ON p.id = f.friend_id
  WHERE f.user_id = auth.uid()
    AND p.last_seen_at IS NOT NULL
    AND p.last_seen_at > NOW() - INTERVAL '3 minutes'
  ORDER BY p.last_seen_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_online_friends() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_friends() TO authenticated;
