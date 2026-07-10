-- Gestão de Aulas: menu visível para quem tem divulgação (não exige inscrição prévia).

CREATE OR REPLACE FUNCTION public.user_can_access_coach_management(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_owns_coach_listing(p_user_id);
$$;
