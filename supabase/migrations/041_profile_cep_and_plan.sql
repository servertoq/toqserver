-- Perfil público: incluir plano; limpar campos de endereço detalhado do perfil

UPDATE public.profiles
SET
  address_street = NULL,
  address_number = NULL,
  address_neighborhood = NULL,
  address_complement = NULL
WHERE
  address_street IS NOT NULL
  OR address_number IS NOT NULL
  OR address_neighborhood IS NOT NULL
  OR address_complement IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_profile_by_username(TEXT);

CREATE FUNCTION public.get_profile_by_username(p_username TEXT)
RETURNS TABLE(
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  birth_date DATE,
  gender public.gender_type,
  player_level public.player_level_type,
  plan public.user_plan,
  created_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  address_zip TEXT,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_complement TEXT,
  address_city TEXT,
  address_state TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.birth_date,
    p.gender,
    p.player_level,
    p.plan,
    p.created_at,
    p.last_seen_at,
    p.address_zip,
    p.address_street,
    p.address_number,
    p.address_neighborhood,
    p.address_complement,
    p.address_city,
    p.address_state
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(TRIM(p_username))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(TEXT) TO authenticated;
