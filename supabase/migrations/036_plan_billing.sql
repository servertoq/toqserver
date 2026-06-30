-- Histórico de mudanças de plano e conclusão via pagamento
-- Idempotente

CREATE TABLE IF NOT EXISTS public.plan_changes (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_plan                  public.user_plan NOT NULL,
  to_plan                    public.user_plan NOT NULL,
  amount_cents               INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency                   TEXT NOT NULL DEFAULT 'brl',
  stripe_checkout_session_id TEXT,
  status                     TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS plan_changes_user_id_idx ON public.plan_changes (user_id);
CREATE INDEX IF NOT EXISTS plan_changes_stripe_session_idx
  ON public.plan_changes (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE public.plan_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê próprias mudanças de plano" ON public.plan_changes;
CREATE POLICY "Usuário vê próprias mudanças de plano"
  ON public.plan_changes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Validação de downgrade (uso dentro dos limites do plano alvo)
-- -----------------------------------------------------------------------------

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
BEGIN
  v_comm := public.count_user_communities(p_user_id, 'community');
  v_clubs := public.count_user_communities(p_user_id, 'club');
  v_coach := (SELECT COUNT(*)::INTEGER FROM public.coach_listings WHERE user_id = p_user_id);
  v_courts := public.count_user_courts_total(p_user_id);

  IF p_target = 'free'::public.user_plan THEN
    RETURN v_comm <= 1 AND v_clubs = 0 AND v_coach = 0 AND v_courts = 0;
  ELSIF p_target = 'professor'::public.user_plan THEN
    RETURN v_comm <= 3 AND v_clubs = 0 AND v_coach <= 1 AND v_courts = 0;
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
  v_order INTEGER;
  v_target_order INTEGER;
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

  v_order := CASE v_current
    WHEN 'free'::public.user_plan THEN 0
    WHEN 'professor'::public.user_plan THEN 1
    ELSE 2
  END;
  v_target_order := CASE p_target
    WHEN 'free'::public.user_plan THEN 0
    WHEN 'professor'::public.user_plan THEN 1
    ELSE 2
  END;

  IF v_target_order >= v_order THEN
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

CREATE OR REPLACE FUNCTION public.complete_plan_upgrade(
  p_change_id UUID,
  p_stripe_session_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.plan_changes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.plan_changes
  WHERE id = p_change_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de plano não encontrado';
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN;
  END IF;

  IF v_row.stripe_checkout_session_id IS DISTINCT FROM p_stripe_session_id THEN
    RAISE EXCEPTION 'Sessão de pagamento inválida';
  END IF;

  UPDATE public.profiles
  SET plan = v_row.to_plan
  WHERE id = v_row.user_id;

  UPDATE public.plan_changes
  SET status = 'completed', completed_at = now()
  WHERE id = p_change_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_downgrade_to_plan(UUID, public.user_plan) TO authenticated;
GRANT EXECUTE ON FUNCTION public.downgrade_user_plan(public.user_plan) TO authenticated;
