-- =============================================================================
-- Toq Tennis — Badges de cargo staff (opcional)
-- =============================================================================
-- O feed já busca cargos via RPC get_staff_role (SECURITY DEFINER).
-- Esta policy só é útil se quiser SELECT direto em staff_members no client.

DROP POLICY IF EXISTS "Cargos staff públicos no feed" ON public.staff_members;
CREATE POLICY "Cargos staff públicos no feed"
  ON public.staff_members FOR SELECT TO authenticated
  USING (true);
