-- Inclui last_seen_at no perfil público por username (status online/offline)
-- Postgres não permite alterar o RETURNS TABLE com CREATE OR REPLACE — recriar a função.

DROP FUNCTION IF EXISTS public.get_profile_by_username(TEXT);

CREATE FUNCTION public.get_profile_by_username(p_username TEXT)
RETURNS TABLE(
  id UUID,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  birth_date DATE,
  gender public.gender_type,
  created_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.bio,
    p.birth_date,
    p.gender,
    p.created_at,
    p.last_seen_at
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(TRIM(p_username))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(TEXT) TO authenticated;
