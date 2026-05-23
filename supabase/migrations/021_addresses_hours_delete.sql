-- =============================================================================
-- Toq Tennis — Endereços (perfil e clubes), horários de clube, exclusão pelo dono
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state CHAR(2);

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state CHAR(2),
  ADD COLUMN IF NOT EXISTS operating_hours JSONB NOT NULL DEFAULT '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- create_community — endereço e horários (clubes)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_community(TEXT, TEXT, TEXT, BOOLEAN, public.community_kind, TEXT);

CREATE OR REPLACE FUNCTION public.create_community(
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT,
  p_is_private BOOLEAN DEFAULT false,
  p_kind public.community_kind DEFAULT 'community',
  p_accent_color TEXT DEFAULT '#437df4',
  p_address_zip TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_neighborhood TEXT DEFAULT NULL,
  p_address_complement TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_state TEXT DEFAULT NULL,
  p_operating_hours JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE(id UUID, slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_private BOOLEAN := p_is_private;
  v_id UUID;
  v_slug TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF TRIM(p_name) = '' OR TRIM(p_slug) = '' THEN
    RAISE EXCEPTION 'Nome e identificador são obrigatórios';
  END IF;

  IF p_kind = 'club'::public.community_kind THEN
    v_private := true;
  END IF;

  INSERT INTO public.communities (
    name, slug, description, is_private, kind, created_by, accent_color,
    address_zip, address_street, address_number, address_neighborhood,
    address_complement, address_city, address_state, operating_hours
  )
  VALUES (
    TRIM(p_name),
    TRIM(p_slug),
    TRIM(p_description),
    v_private,
    p_kind,
    v_uid,
    COALESCE(NULLIF(TRIM(p_accent_color), ''), '#437df4'),
    NULLIF(TRIM(p_address_zip), ''),
    NULLIF(TRIM(p_address_street), ''),
    NULLIF(TRIM(p_address_number), ''),
    NULLIF(TRIM(p_address_neighborhood), ''),
    NULLIF(TRIM(p_address_complement), ''),
    NULLIF(TRIM(p_address_city), ''),
    NULLIF(UPPER(TRIM(p_address_state)), ''),
    COALESCE(p_operating_hours, '[]'::jsonb)
  )
  RETURNING communities.id, communities.slug INTO v_id, v_slug;

  RETURN QUERY SELECT v_id, v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_community(
  TEXT, TEXT, TEXT, BOOLEAN, public.community_kind, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_community(
  TEXT, TEXT, TEXT, BOOLEAN, public.community_kind, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;

-- -----------------------------------------------------------------------------
-- delete_community — apenas administrador (owner)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_community(p_community_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_community_owner(p_community_id, v_uid) THEN
    RAISE EXCEPTION 'Apenas o administrador pode excluir este grupo';
  END IF;

  DELETE FROM public.communities WHERE id = p_community_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_community(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_community(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- get_profile_by_username — inclui endereço público
-- -----------------------------------------------------------------------------
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
