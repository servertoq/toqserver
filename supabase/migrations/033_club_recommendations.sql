-- Indicações de clubes feitas por usuários
-- Idempotente

CREATE TABLE IF NOT EXISTS public.club_recommendations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_name  TEXT NOT NULL CHECK (char_length(trim(club_name)) >= 2),
  contact    TEXT NOT NULL CHECK (char_length(trim(contact)) >= 3),
  notes      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'added', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_recommendations_user_id_idx
  ON public.club_recommendations (user_id);

CREATE INDEX IF NOT EXISTS club_recommendations_created_at_idx
  ON public.club_recommendations (created_at DESC);

CREATE INDEX IF NOT EXISTS club_recommendations_status_idx
  ON public.club_recommendations (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_read_club_recommendations(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_moderate_platform(p_user_id)
      OR public.get_staff_role(p_user_id) = 'marketing';
$$;

ALTER TABLE public.club_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário indica clube" ON public.club_recommendations;
CREATE POLICY "Usuário indica clube"
  ON public.club_recommendations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário vê próprias indicações" ON public.club_recommendations;
CREATE POLICY "Usuário vê próprias indicações"
  ON public.club_recommendations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff lê indicações de clube" ON public.club_recommendations;
CREATE POLICY "Staff lê indicações de clube"
  ON public.club_recommendations FOR SELECT TO authenticated
  USING (public.can_read_club_recommendations(auth.uid()));

DROP POLICY IF EXISTS "Staff atualiza indicações de clube" ON public.club_recommendations;
CREATE POLICY "Staff atualiza indicações de clube"
  ON public.club_recommendations FOR UPDATE TO authenticated
  USING (public.can_read_club_recommendations(auth.uid()))
  WITH CHECK (public.can_read_club_recommendations(auth.uid()));

GRANT EXECUTE ON FUNCTION public.can_read_club_recommendations(UUID) TO authenticated;
