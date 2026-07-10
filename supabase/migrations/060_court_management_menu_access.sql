-- Gestão de Quadras: menu para dono/mod de clube, quadra avulsa ou staff da plataforma.

CREATE OR REPLACE FUNCTION public.user_can_access_court_management(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_moderate_platform(p_user_id)
  OR EXISTS (
    SELECT 1 FROM public.courts c WHERE c.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.community_members cm
    WHERE cm.user_id = p_user_id
      AND cm.role IN ('owner', 'moderator')
  );
$$;
