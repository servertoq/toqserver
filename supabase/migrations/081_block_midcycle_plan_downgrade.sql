-- Bloqueia downgrade imediato enquanto o ciclo pago ainda está ativo.
-- A volta para "Usuário" (free) acontece via expire_due_plans() após o vencimento
-- sem renovação / pagamento.

CREATE OR REPLACE FUNCTION public.downgrade_user_plan(p_target public.user_plan)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_current public.user_plan;
  v_expires TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT plan, plan_expires_at
  INTO v_current, v_expires
  FROM public.profiles
  WHERE id = v_uid;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF p_target = v_current THEN
    RAISE EXCEPTION 'Você já está neste plano';
  END IF;

  IF public.plan_order(p_target) >= public.plan_order(v_current) THEN
    RAISE EXCEPTION 'Use o checkout para fazer upgrade de plano';
  END IF;

  -- Ciclo ainda válido: não permite voltar para plano inferior na hora
  IF v_current IS DISTINCT FROM 'free'::public.user_plan
     AND (v_expires IS NULL OR v_expires > now()) THEN
    RAISE EXCEPTION
      'Seu plano atual ainda está ativo. Ele só volta para Usuário automaticamente se você não renovar após o vencimento.';
  END IF;

  -- Já vencido (cron ainda não rodou): só permite ir para free
  IF p_target IS DISTINCT FROM 'free'::public.user_plan THEN
    RAISE EXCEPTION
      'Após o vencimento, assine o plano desejado pelo checkout. Sem renovação, a conta volta para Usuário.';
  END IF;

  IF NOT public.can_downgrade_to_plan(v_uid, p_target) THEN
    RAISE EXCEPTION 'Reduza ou remova conteúdo extra antes de mudar para este plano (comunidades, clube, quadras ou anúncio de aulas)';
  END IF;

  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET
    plan = p_target,
    plan_expires_at = NULL,
    plan_activated_at = NULL,
    plan_billing_mode = NULL,
    mp_preapproval_id = NULL
  WHERE id = v_uid;

  INSERT INTO public.plan_changes (user_id, from_plan, to_plan, amount_cents, status, completed_at, provider)
  VALUES (v_uid, v_current, p_target, 0, 'completed', now(), 'manual');
END;
$$;

GRANT EXECUTE ON FUNCTION public.downgrade_user_plan(public.user_plan) TO authenticated;
