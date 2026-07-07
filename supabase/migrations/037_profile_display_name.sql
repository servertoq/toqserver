-- Nome exibido na rede (separado do username/URL do perfil)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_name_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length CHECK (
    display_name IS NULL OR char_length(trim(display_name)) BETWEEN 2 AND 60
  );

COMMENT ON COLUMN public.profiles.display_name IS
  'Nome público exibido na rede. O username continua sendo a URL do perfil.';

-- RPC de perfil público passa a retornar display_name
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
