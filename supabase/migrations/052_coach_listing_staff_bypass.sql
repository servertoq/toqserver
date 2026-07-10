-- Staff admin (CEO/CTO) pode divulgar aulas para testes e moderação,
-- além do plano Professor.
-- Substituído por 053_staff_unlimited_plan_access.sql (inclui moderador).

CREATE OR REPLACE FUNCTION public.user_can_create_coach_listing(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_staff_admin(p_user_id)
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
