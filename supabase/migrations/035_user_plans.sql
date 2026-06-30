-- =============================================================================
-- Planos de usuário: free, professor, empresário
-- Idempotente
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.user_plan AS ENUM ('free', 'professor', 'empresario');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan public.user_plan NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS show_plan_badge BOOLEAN NOT NULL DEFAULT true;

-- -----------------------------------------------------------------------------
-- Contagens e limites
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.count_user_communities(
  p_user_id UUID,
  p_kind public.community_kind DEFAULT 'community'
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.communities
  WHERE created_by = p_user_id
    AND kind = p_kind;
$$;

CREATE OR REPLACE FUNCTION public.count_user_courts_total(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (SELECT COUNT(*) FROM public.courts WHERE owner_id = p_user_id)
    +
    (SELECT COUNT(*) FROM public.club_courts cc
     JOIN public.communities c ON c.id = cc.community_id
     WHERE c.created_by = p_user_id AND c.kind = 'club')
  )::INTEGER;
$$;

CREATE OR REPLACE FUNCTION public.max_communities_for_plan(p_plan public.user_plan)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'free'::public.user_plan THEN 1
    ELSE 3
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_community(
  p_user_id UUID,
  p_kind public.community_kind DEFAULT 'community'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.user_plan;
  v_count INTEGER;
  v_max INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  IF v_plan IS NULL THEN
    RETURN false;
  END IF;

  IF p_kind = 'club'::public.community_kind THEN
    IF v_plan <> 'empresario'::public.user_plan THEN
      RETURN false;
    END IF;
    RETURN public.count_user_communities(p_user_id, 'club') < 1;
  END IF;

  v_count := public.count_user_communities(p_user_id, 'community');
  v_max := public.max_communities_for_plan(v_plan);
  RETURN v_count < v_max;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_coach_listing(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND plan IN ('professor'::public.user_plan, 'empresario'::public.user_plan)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.coach_listings WHERE user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_court(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.user_plan;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  IF v_plan IS DISTINCT FROM 'empresario'::public.user_plan THEN
    RETURN false;
  END IF;
  RETURN public.count_user_courts_total(p_user_id) < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_plan_usage()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'plan', p.plan,
    'show_plan_badge', p.show_plan_badge,
    'communities_count', public.count_user_communities(p.id, 'community'),
    'communities_max', public.max_communities_for_plan(p.plan),
    'clubs_count', public.count_user_communities(p.id, 'club'),
    'clubs_max', CASE WHEN p.plan = 'empresario'::public.user_plan THEN 1 ELSE 0 END,
    'coach_listings_count', (
      SELECT COUNT(*)::INTEGER FROM public.coach_listings WHERE user_id = p.id
    ),
    'coach_listings_max', CASE
      WHEN p.plan IN ('professor'::public.user_plan, 'empresario'::public.user_plan) THEN 1
      ELSE 0
    END,
    'courts_count', public.count_user_courts_total(p.id),
    'courts_max', CASE WHEN p.plan = 'empresario'::public.user_plan THEN 5 ELSE 0 END,
    'can_create_coach_listing', public.user_can_create_coach_listing(p.id),
    'can_create_club', public.user_can_create_community(p.id, 'club'),
    'can_create_court', public.user_can_create_court(p.id),
    'can_create_community', public.user_can_create_community(p.id, 'community')
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- create_community — respeita limites de plano
-- -----------------------------------------------------------------------------

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
  v_plan public.user_plan;
  v_max INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF TRIM(p_name) = '' OR TRIM(p_slug) = '' THEN
    RAISE EXCEPTION 'Nome e identificador são obrigatórios';
  END IF;

  IF NOT public.user_can_create_community(v_uid, p_kind) THEN
    SELECT plan INTO v_plan FROM public.profiles WHERE id = v_uid;
    IF p_kind = 'club'::public.community_kind THEN
      IF v_plan IS DISTINCT FROM 'empresario'::public.user_plan THEN
        RAISE EXCEPTION 'Apenas usuários do plano Empresário podem criar clubes.';
      END IF;
      RAISE EXCEPTION 'Limite de clubes atingido (máx. 1 no plano Empresário).';
    END IF;
    v_max := public.max_communities_for_plan(COALESCE(v_plan, 'free'::public.user_plan));
    RAISE EXCEPTION 'Limite de comunidades atingido (máx. % no seu plano).', v_max;
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

-- -----------------------------------------------------------------------------
-- RLS — coach listings (só professor/empresário)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Usuário divulga aulas" ON public.coach_listings;
CREATE POLICY "Usuário divulga aulas"
  ON public.coach_listings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_can_create_coach_listing(auth.uid())
  );

-- -----------------------------------------------------------------------------
-- RLS — quadras públicas (só empresário, máx. 5 no total)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Usuário cadastra quadra" ON public.courts;
CREATE POLICY "Usuário cadastra quadra"
  ON public.courts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND public.user_can_create_court(auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Trigger — quadras de clube (conta no limite do dono do clube)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_club_court_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT created_by INTO v_owner
  FROM public.communities
  WHERE id = NEW.community_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Clube não encontrado';
  END IF;

  IF NOT public.user_can_create_court(v_owner) THEN
    RAISE EXCEPTION 'Limite de quadras atingido (máx. 5 no plano Empresário, incluindo quadras do clube e da aba Quadras).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS club_courts_plan_limit ON public.club_courts;
CREATE TRIGGER club_courts_plan_limit
  BEFORE INSERT ON public.club_courts
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_club_court_plan_limit();

-- -----------------------------------------------------------------------------
-- Staff — alterar plano de usuário
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_set_user_plan(
  p_user_id UUID,
  p_plan public.user_plan
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_staff_admin();
  UPDATE public.profiles SET plan = p_plan WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_user_communities(UUID, public.community_kind) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_courts_total(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_create_community(UUID, public.community_kind) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_create_coach_listing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_create_court(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_plan_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_set_user_plan(UUID, public.user_plan) TO authenticated;
