-- =============================================================================
-- Planos v2: Usuário (3 comunidades), Professor, Proprietário, Proprietário Plus
-- + destaque de posts no feed (impressões)
-- Requer 050_user_plan_enum_proprietario.sql já aplicada.
-- Idempotente
-- =============================================================================

UPDATE public.profiles
SET plan = 'proprietario'::public.user_plan
WHERE plan = 'empresario'::public.user_plan;

UPDATE public.plan_changes
SET from_plan = 'proprietario'::public.user_plan
WHERE from_plan = 'empresario'::public.user_plan;

UPDATE public.plan_changes
SET to_plan = 'proprietario'::public.user_plan
WHERE to_plan = 'empresario'::public.user_plan;

-- -----------------------------------------------------------------------------
-- Impressões de destaque no feed
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.post_boost_impressions (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  last_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS post_boost_impressions_user_idx
  ON public.post_boost_impressions (user_id, last_shown_at DESC);

ALTER TABLE public.post_boost_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário gerencia próprias impressões de destaque" ON public.post_boost_impressions;
CREATE POLICY "Usuário gerencia próprias impressões de destaque"
  ON public.post_boost_impressions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Helpers de plano
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.plan_order(p_plan public.user_plan)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'free'::public.user_plan THEN 0
    WHEN 'professor'::public.user_plan THEN 1
    WHEN 'proprietario'::public.user_plan THEN 2
    WHEN 'proprietario_plus'::public.user_plan THEN 3
    WHEN 'empresario'::public.user_plan THEN 2
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_professor_plan(p_plan public.user_plan)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_plan = 'professor'::public.user_plan;
$$;

CREATE OR REPLACE FUNCTION public.is_proprietario_plan(p_plan public.user_plan)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_plan IN ('proprietario'::public.user_plan, 'proprietario_plus'::public.user_plan, 'empresario'::public.user_plan);
$$;

CREATE OR REPLACE FUNCTION public.max_communities_for_plan(p_plan public.user_plan)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 3;
$$;

CREATE OR REPLACE FUNCTION public.max_clubs_for_plan(p_plan public.user_plan)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_plan = 'proprietario_plus'::public.user_plan THEN NULL
    WHEN public.is_proprietario_plan(p_plan) THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.max_courts_for_plan(p_plan public.user_plan)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_plan = 'proprietario_plus'::public.user_plan THEN NULL
    WHEN public.is_proprietario_plan(p_plan) THEN 4
    ELSE 0
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
  v_max_clubs INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  IF v_plan IS NULL THEN
    RETURN false;
  END IF;

  IF p_kind = 'club'::public.community_kind THEN
    IF NOT public.is_proprietario_plan(v_plan) THEN
      RETURN false;
    END IF;
    v_max_clubs := public.max_clubs_for_plan(v_plan);
    IF v_max_clubs IS NULL THEN
      RETURN true;
    END IF;
    RETURN public.count_user_communities(p_user_id, 'club') < v_max_clubs;
  END IF;

  v_count := public.count_user_communities(p_user_id, 'community');
  RETURN v_count < public.max_communities_for_plan(v_plan);
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
      AND plan = 'professor'::public.user_plan
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
  v_max INTEGER;
  v_count INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  IF NOT public.is_proprietario_plan(v_plan) THEN
    RETURN false;
  END IF;

  v_max := public.max_courts_for_plan(v_plan);
  IF v_max IS NULL THEN
    RETURN true;
  END IF;

  v_count := public.count_user_courts_total(p_user_id);
  RETURN v_count < v_max;
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
    'clubs_max', public.max_clubs_for_plan(p.plan),
    'coach_listings_count', (
      SELECT COUNT(*)::INTEGER FROM public.coach_listings WHERE user_id = p.id
    ),
    'coach_listings_max', CASE
      WHEN p.plan = 'professor'::public.user_plan THEN 1
      ELSE 0
    END,
    'courts_count', public.count_user_courts_total(p.id),
    'courts_max', public.max_courts_for_plan(p.plan),
    'can_create_coach_listing', public.user_can_create_coach_listing(p.id),
    'can_create_club', public.user_can_create_community(p.id, 'club'),
    'can_create_court', public.user_can_create_court(p.id),
    'can_create_community', public.user_can_create_community(p.id, 'community'),
    'has_feed_boost', p.plan IN (
      'professor'::public.user_plan,
      'proprietario'::public.user_plan,
      'proprietario_plus'::public.user_plan
    ),
    'feed_boost_hours', CASE
      WHEN p.plan = 'professor'::public.user_plan THEN 3
      WHEN public.is_proprietario_plan(p.plan) THEN 2
      ELSE NULL
    END
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

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
      IF NOT public.is_proprietario_plan(v_plan) THEN
        RAISE EXCEPTION 'Apenas planos Proprietário podem criar clubes.';
      END IF;
      IF v_plan = 'proprietario_plus'::public.user_plan THEN
        RAISE EXCEPTION 'Limite de clubes atingido.';
      END IF;
      RAISE EXCEPTION 'Limite de clubes atingido (máx. 1 no plano Proprietário).';
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
    RAISE EXCEPTION 'Limite de quadras atingido no seu plano Proprietário.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_downgrade_to_plan(
  p_user_id UUID,
  p_target public.user_plan
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comm INTEGER;
  v_clubs INTEGER;
  v_coach INTEGER;
  v_courts INTEGER;
  v_max_clubs INTEGER;
  v_max_courts INTEGER;
BEGIN
  v_comm := public.count_user_communities(p_user_id, 'community');
  v_clubs := public.count_user_communities(p_user_id, 'club');
  v_coach := (SELECT COUNT(*)::INTEGER FROM public.coach_listings WHERE user_id = p_user_id);
  v_courts := public.count_user_courts_total(p_user_id);
  v_max_clubs := public.max_clubs_for_plan(p_target);
  v_max_courts := public.max_courts_for_plan(p_target);

  IF p_target = 'free'::public.user_plan THEN
    RETURN v_comm <= 3 AND v_clubs = 0 AND v_coach = 0 AND v_courts = 0;
  ELSIF p_target = 'professor'::public.user_plan THEN
    RETURN v_comm <= 3 AND v_clubs = 0 AND v_coach <= 1 AND v_courts = 0;
  ELSIF p_target = 'proprietario'::public.user_plan THEN
    RETURN v_comm <= 3
      AND v_clubs <= COALESCE(v_max_clubs, 999999)
      AND v_coach = 0
      AND v_courts <= COALESCE(v_max_courts, 999999);
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.downgrade_user_plan(p_target public.user_plan)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_current public.user_plan;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT plan INTO v_current FROM public.profiles WHERE id = v_uid;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF p_target = v_current THEN
    RAISE EXCEPTION 'Você já está neste plano';
  END IF;

  IF public.plan_order(p_target) >= public.plan_order(v_current) THEN
    RAISE EXCEPTION 'Use o checkout para fazer upgrade de plano';
  END IF;

  IF NOT public.can_downgrade_to_plan(v_uid, p_target) THEN
    RAISE EXCEPTION 'Reduza ou remova conteúdo extra antes de mudar para este plano (comunidades, clube, quadras ou anúncio de aulas)';
  END IF;

  UPDATE public.profiles SET plan = p_target WHERE id = v_uid;

  INSERT INTO public.plan_changes (user_id, from_plan, to_plan, amount_cents, status, completed_at)
  VALUES (v_uid, v_current, p_target, 0, 'completed', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.record_post_boost_impression(p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.post_boost_impressions (user_id, post_id, last_shown_at)
  VALUES (auth.uid(), p_post_id, now())
  ON CONFLICT (user_id, post_id)
  DO UPDATE SET last_shown_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_order(public.user_plan) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_post_boost_impression(UUID) TO authenticated;
