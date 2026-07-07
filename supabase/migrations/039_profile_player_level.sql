-- Selo do jogador: Iniciante ou Profissional

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_level_type') THEN
    CREATE TYPE public.player_level_type AS ENUM ('iniciante', 'profissional');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS player_level public.player_level_type NOT NULL DEFAULT 'iniciante';

COMMENT ON COLUMN public.profiles.player_level IS
  'Selo público do jogador: iniciante ou profissional.';

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
