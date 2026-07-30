-- =============================================================================
-- Plano Promotor (R$ 50) + torneios avulsos + painel Gestão de Torneios
-- Requer 058_user_plan_enum_promotor.sql já aplicada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ordem e helpers de plano
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.plan_order(p_plan public.user_plan)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'free'::public.user_plan THEN 0
    WHEN 'professor'::public.user_plan THEN 1
    WHEN 'promotor'::public.user_plan THEN 2
    WHEN 'proprietario'::public.user_plan THEN 3
    WHEN 'proprietario_plus'::public.user_plan THEN 4
    WHEN 'empresario'::public.user_plan THEN 3
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_promotor_plan(p_plan public.user_plan)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_plan = 'promotor'::public.user_plan;
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_standalone_tournament(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_moderate_platform(p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_user_id
        AND plan = 'promotor'::public.user_plan
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_promoter_management(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_moderate_platform(p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_user_id
        AND plan = 'promotor'::public.user_plan
    );
$$;

-- -----------------------------------------------------------------------------
-- Torneios avulsos (community_id opcional + created_by + localização)
-- -----------------------------------------------------------------------------

ALTER TABLE public.club_tournaments
  ALTER COLUMN community_id DROP NOT NULL;

ALTER TABLE public.club_tournaments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.club_tournaments
  ADD COLUMN IF NOT EXISTS location_label TEXT;

UPDATE public.club_tournaments t
SET created_by = c.created_by
FROM public.communities c
WHERE t.community_id = c.id
  AND t.created_by IS NULL;

CREATE INDEX IF NOT EXISTS club_tournaments_created_by_idx
  ON public.club_tournaments (created_by, created_at DESC)
  WHERE community_id IS NULL;

CREATE INDEX IF NOT EXISTS club_tournaments_standalone_public_idx
  ON public.club_tournaments (is_active, is_private, created_at DESC)
  WHERE community_id IS NULL;

-- -----------------------------------------------------------------------------
-- RLS torneios (clube OU avulso do promotor)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Torneios visíveis conforme privacidade" ON public.club_tournaments;
CREATE POLICY "Torneios visíveis conforme privacidade"
  ON public.club_tournaments FOR SELECT TO authenticated
  USING (
    (
      community_id IS NOT NULL
      AND (
        public.can_moderate_community(community_id, auth.uid())
        OR (
          is_active = true
          AND (
            is_private = false
            OR public.is_community_member(community_id, auth.uid())
          )
        )
      )
    )
    OR (
      community_id IS NULL
      AND (
        created_by = auth.uid()
        OR (is_active = true AND is_private = false)
        OR public.can_moderate_platform(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Moderadores inserem torneios" ON public.club_tournaments;
CREATE POLICY "Moderadores inserem torneios"
  ON public.club_tournaments FOR INSERT TO authenticated
  WITH CHECK (
    (
      community_id IS NOT NULL
      AND public.can_moderate_community(community_id, auth.uid())
    )
    OR (
      community_id IS NULL
      AND created_by = auth.uid()
      AND public.user_can_create_standalone_tournament(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Moderadores atualizam torneios" ON public.club_tournaments;
CREATE POLICY "Moderadores atualizam torneios"
  ON public.club_tournaments FOR UPDATE TO authenticated
  USING (
    (
      community_id IS NOT NULL
      AND public.can_moderate_community(community_id, auth.uid())
    )
    OR (
      community_id IS NULL
      AND created_by = auth.uid()
    )
    OR public.can_moderate_platform(auth.uid())
  )
  WITH CHECK (
    (
      community_id IS NOT NULL
      AND public.can_moderate_community(community_id, auth.uid())
    )
    OR (
      community_id IS NULL
      AND created_by = auth.uid()
    )
    OR public.can_moderate_platform(auth.uid())
  );

DROP POLICY IF EXISTS "Moderadores excluem torneios" ON public.club_tournaments;
CREATE POLICY "Moderadores excluem torneios"
  ON public.club_tournaments FOR DELETE TO authenticated
  USING (
    (
      community_id IS NOT NULL
      AND public.can_moderate_community(community_id, auth.uid())
    )
    OR (
      community_id IS NULL
      AND created_by = auth.uid()
    )
    OR public.can_moderate_platform(auth.uid())
  );

-- -----------------------------------------------------------------------------
-- get_my_plan_usage + downgrade (inclui promotor)
-- -----------------------------------------------------------------------------

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
    'can_create_standalone_tournament', public.user_can_create_standalone_tournament(v_uid),
    'has_feed_boost', v_profile.plan IN (
      'professor'::public.user_plan,
      'promotor'::public.user_plan,
      'proprietario'::public.user_plan,
      'proprietario_plus'::public.user_plan
    ),
    'feed_boost_hours', CASE
      WHEN v_profile.plan = 'professor'::public.user_plan THEN 3
      WHEN v_profile.plan = 'promotor'::public.user_plan THEN 4
      WHEN public.is_proprietario_plan(v_profile.plan) THEN 2
      ELSE NULL
    END
  );
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
  v_standalone INTEGER;
  v_max_clubs INTEGER;
  v_max_courts INTEGER;
BEGIN
  v_comm := public.count_user_communities(p_user_id, 'community');
  v_clubs := public.count_user_communities(p_user_id, 'club');
  v_coach := (SELECT COUNT(*)::INTEGER FROM public.coach_listings WHERE user_id = p_user_id);
  v_courts := public.count_user_courts_total(p_user_id);
  v_standalone := (
    SELECT COUNT(*)::INTEGER FROM public.club_tournaments
    WHERE created_by = p_user_id AND community_id IS NULL
  );
  v_max_clubs := public.max_clubs_for_plan(p_target);
  v_max_courts := public.max_courts_for_plan(p_target);

  IF p_target = 'free'::public.user_plan THEN
    RETURN v_comm <= 3 AND v_clubs = 0 AND v_coach = 0 AND v_courts = 0 AND v_standalone = 0;
  ELSIF p_target = 'professor'::public.user_plan THEN
    RETURN v_comm <= 3 AND v_clubs = 0 AND v_coach <= 1 AND v_courts = 0 AND v_standalone = 0;
  ELSIF p_target = 'promotor'::public.user_plan THEN
    RETURN v_comm <= 3 AND v_clubs = 0 AND v_coach = 0 AND v_courts = 0;
  ELSIF p_target = 'proprietario'::public.user_plan THEN
    RETURN v_comm <= 3
      AND v_clubs <= COALESCE(v_max_clubs, 999999)
      AND v_coach = 0
      AND v_courts <= COALESCE(v_max_courts, 999999);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_promotor_plan(public.user_plan) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_create_standalone_tournament(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_promoter_management(UUID) TO authenticated;
