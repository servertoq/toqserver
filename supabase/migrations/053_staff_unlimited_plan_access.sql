-- CEO, CTO e Moderador ignoram limites de plano (comunidades, clubes, quadras, aulas).

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
  IF public.can_moderate_platform(p_user_id) THEN
    RETURN true;
  END IF;

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
  SELECT
    public.can_moderate_platform(p_user_id)
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id
          AND plan = 'professor'::public.user_plan
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.coach_listings WHERE user_id = p_user_id
      )
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
  IF public.can_moderate_platform(p_user_id) THEN
    RETURN true;
  END IF;

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_staff_unlimited BOOLEAN;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_staff_unlimited := public.can_moderate_platform(v_uid);

  RETURN json_build_object(
    'plan', v_profile.plan,
    'show_plan_badge', v_profile.show_plan_badge,
    'communities_count', public.count_user_communities(v_uid, 'community'),
    'communities_max', CASE WHEN v_staff_unlimited THEN NULL ELSE public.max_communities_for_plan(v_profile.plan) END,
    'clubs_count', public.count_user_communities(v_uid, 'club'),
    'clubs_max', CASE WHEN v_staff_unlimited THEN NULL ELSE public.max_clubs_for_plan(v_profile.plan) END,
    'coach_listings_count', (
      SELECT COUNT(*)::INTEGER FROM public.coach_listings WHERE user_id = v_uid
    ),
    'coach_listings_max', CASE
      WHEN v_staff_unlimited OR v_profile.plan = 'professor'::public.user_plan THEN 1
      ELSE 0
    END,
    'courts_count', public.count_user_courts_total(v_uid),
    'courts_max', CASE WHEN v_staff_unlimited THEN NULL ELSE public.max_courts_for_plan(v_profile.plan) END,
    'can_create_coach_listing', public.user_can_create_coach_listing(v_uid),
    'can_create_club', public.user_can_create_community(v_uid, 'club'),
    'can_create_court', public.user_can_create_court(v_uid),
    'can_create_community', public.user_can_create_community(v_uid, 'community'),
    'has_feed_boost', v_profile.plan IN (
      'professor'::public.user_plan,
      'proprietario'::public.user_plan,
      'proprietario_plus'::public.user_plan
    ),
    'feed_boost_hours', CASE
      WHEN v_profile.plan = 'professor'::public.user_plan THEN 3
      WHEN public.is_proprietario_plan(v_profile.plan) THEN 2
      ELSE NULL
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_moderate_platform(UUID) TO authenticated;
