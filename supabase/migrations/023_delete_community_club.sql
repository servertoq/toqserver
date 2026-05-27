-- =============================================================================
-- Toq Tennis — Permitir dono excluir comunidade/clube
-- =============================================================================

-- RLS: permitir DELETE apenas ao dono
DROP POLICY IF EXISTS "Dono remove comunidade" ON public.communities;
DROP POLICY IF EXISTS "Dono remove comunidade ou clube" ON public.communities;
DROP POLICY IF EXISTS "Dono remove clube" ON public.communities;

CREATE POLICY "Dono remove comunidade ou clube"
  ON public.communities FOR DELETE TO authenticated
  USING (public.is_community_owner(id, (SELECT auth.uid())));

