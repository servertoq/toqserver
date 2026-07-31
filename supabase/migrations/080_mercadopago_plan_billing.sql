-- =============================================================================
-- Mercado Pago billing: validade 30 dias, upgrade 15 dias, renovação
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_billing_mode TEXT
    CHECK (plan_billing_mode IS NULL OR plan_billing_mode IN ('pix', 'card_once', 'card_recurring')),
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_renewal_reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_plan_expires_at_idx
  ON public.profiles (plan_expires_at)
  WHERE plan IS DISTINCT FROM 'free'::public.user_plan;

ALTER TABLE public.plan_changes
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_mode TEXT
    CHECK (payment_mode IS NULL OR payment_mode IN ('pix', 'card_once', 'card_recurring')),
  ADD COLUMN IF NOT EXISTS charge_kind TEXT
    CHECK (charge_kind IS NULL OR charge_kind IN ('new', 'renew', 'upgrade_diff', 'upgrade_full')),
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mercadopago'
    CHECK (provider IN ('stripe', 'mercadopago', 'manual'));

CREATE INDEX IF NOT EXISTS plan_changes_mp_preference_idx
  ON public.plan_changes (mp_preference_id)
  WHERE mp_preference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS plan_changes_mp_payment_idx
  ON public.plan_changes (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS plan_changes_mp_preapproval_idx
  ON public.plan_changes (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

-- Protege colunas de billing no perfil
CREATE OR REPLACE FUNCTION public.protect_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass TEXT;
BEGIN
  v_bypass := NULLIF(current_setting('app.allow_privileged_profile_update', true), '');
  IF v_bypass = '1' THEN
    RETURN NEW;
  END IF;

  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.plan_activated_at IS DISTINCT FROM OLD.plan_activated_at
     OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at
     OR NEW.plan_billing_mode IS DISTINCT FROM OLD.plan_billing_mode
     OR NEW.mp_preapproval_id IS DISTINCT FROM OLD.mp_preapproval_id
     OR NEW.plan_renewal_reminder_sent_at IS DISTINCT FROM OLD.plan_renewal_reminder_sent_at THEN
    RAISE EXCEPTION 'Alteração de plano/billing não permitida por esta via'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason THEN
    RAISE EXCEPTION 'Alteração de banimento não permitida por esta via'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Plano efetivo: pago só se não expirou
CREATE OR REPLACE FUNCTION public.effective_user_plan(p_user_id UUID)
RETURNS public.user_plan
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.user_plan;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT plan, plan_expires_at INTO v_plan, v_expires
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND OR v_plan IS NULL THEN
    RETURN 'free'::public.user_plan;
  END IF;

  IF v_plan = 'free'::public.user_plan THEN
    RETURN 'free'::public.user_plan;
  END IF;

  -- Staff com plano pago sem expiração explícita: mantém
  IF v_expires IS NULL THEN
    RETURN v_plan;
  END IF;

  IF v_expires < now() THEN
    RETURN 'free'::public.user_plan;
  END IF;

  RETURN v_plan;
END;
$$;

GRANT EXECUTE ON FUNCTION public.effective_user_plan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_user_plan(UUID) TO service_role;

-- Aplica pagamento MP (upgrade / renovação / nova assinatura)
CREATE OR REPLACE FUNCTION public.complete_plan_payment(
  p_change_id UUID,
  p_mp_payment_id TEXT DEFAULT NULL,
  p_mp_preapproval_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.plan_changes%ROWTYPE;
  v_expires TIMESTAMPTZ;
  v_activated TIMESTAMPTZ;
  v_new_expires TIMESTAMPTZ;
  v_new_activated TIMESTAMPTZ;
  v_billing_mode TEXT;
BEGIN
  SELECT * INTO v_row
  FROM public.plan_changes
  WHERE id = p_change_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de plano não encontrado';
  END IF;

  IF v_row.status = 'completed' THEN
    -- Idempotência: ainda atualiza ids de pagamento se faltarem
    IF p_mp_payment_id IS NOT NULL AND v_row.mp_payment_id IS NULL THEN
      UPDATE public.plan_changes SET mp_payment_id = p_mp_payment_id WHERE id = p_change_id;
    END IF;
    RETURN;
  END IF;

  SELECT plan_expires_at, plan_activated_at
  INTO v_expires, v_activated
  FROM public.profiles
  WHERE id = v_row.user_id;

  v_billing_mode := COALESCE(v_row.payment_mode, 'pix');

  IF v_row.charge_kind = 'upgrade_diff' AND v_expires IS NOT NULL AND v_expires > now() THEN
    -- Mantém o ciclo atual (pagou só a diferença)
    v_new_expires := v_expires;
    v_new_activated := COALESCE(v_activated, now());
  ELSE
    -- new / renew / upgrade_full: soma 30 dias a partir do que ainda resta
    v_new_expires := GREATEST(COALESCE(v_expires, now()), now()) + interval '30 days';
    v_new_activated := now();
  END IF;

  PERFORM set_config('app.allow_privileged_profile_update', '1', true);

  UPDATE public.profiles
  SET
    plan = v_row.to_plan,
    plan_expires_at = v_new_expires,
    plan_activated_at = v_new_activated,
    plan_billing_mode = v_billing_mode,
    mp_preapproval_id = COALESCE(p_mp_preapproval_id, mp_preapproval_id),
    plan_renewal_reminder_sent_at = NULL
  WHERE id = v_row.user_id;

  UPDATE public.plan_changes
  SET
    status = 'completed',
    completed_at = now(),
    mp_payment_id = COALESCE(p_mp_payment_id, mp_payment_id),
    mp_preapproval_id = COALESCE(p_mp_preapproval_id, mp_preapproval_id),
    provider = 'mercadopago'
  WHERE id = p_change_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_plan_payment(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_plan_payment(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.complete_plan_payment(UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_plan_payment(UUID, TEXT, TEXT) TO service_role;

-- Compat: Stripe legado ainda pode concluir se existir sessão
CREATE OR REPLACE FUNCTION public.complete_plan_upgrade(
  p_change_id UUID,
  p_stripe_session_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Redireciona para o fluxo MP com charge_kind new/upgrade_full implícito via complete_plan_payment
  -- Mantém assinatura antiga para webhooks Stripe residuais
  PERFORM set_config('app.allow_privileged_profile_update', '1', true);

  UPDATE public.plan_changes
  SET stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, p_stripe_session_id)
  WHERE id = p_change_id
    AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id = p_stripe_session_id);

  PERFORM public.complete_plan_payment(p_change_id, NULL, NULL);
END;
$$;

-- Expira planos vencidos → free (desliga funções)
CREATE OR REPLACE FUNCTION public.expire_due_plans()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, plan
    FROM public.profiles
    WHERE plan IS DISTINCT FROM 'free'::public.user_plan
      AND plan_expires_at IS NOT NULL
      AND plan_expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM set_config('app.allow_privileged_profile_update', '1', true);
    UPDATE public.profiles
    SET
      plan = 'free'::public.user_plan,
      plan_billing_mode = NULL,
      mp_preapproval_id = NULL,
      plan_renewal_reminder_sent_at = NULL
      -- mantém plan_expires_at / activated para histórico
    WHERE id = r.id;

    INSERT INTO public.plan_changes (
      user_id, from_plan, to_plan, amount_cents, status, completed_at, provider, charge_kind
    ) VALUES (
      r.id, r.plan, 'free'::public.user_plan, 0, 'completed', now(), 'manual', NULL
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_due_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_due_plans() TO service_role;

-- Lista quem precisa de lembrete (3 dias antes)
CREATE OR REPLACE FUNCTION public.list_plan_renewal_reminders()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  plan public.user_plan,
  plan_expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.plan, p.plan_expires_at
  FROM public.profiles p
  WHERE p.plan IS DISTINCT FROM 'free'::public.user_plan
    AND p.plan_expires_at IS NOT NULL
    AND p.plan_expires_at > now()
    AND p.plan_expires_at <= now() + interval '3 days'
    AND (
      p.plan_renewal_reminder_sent_at IS NULL
      OR p.plan_renewal_reminder_sent_at < (p.plan_expires_at - interval '3 days')
    )
    AND COALESCE(p.plan_billing_mode, 'pix') IN ('pix', 'card_once');
$$;

REVOKE ALL ON FUNCTION public.list_plan_renewal_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_plan_renewal_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.mark_plan_renewal_reminder_sent(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET plan_renewal_reminder_sent_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_plan_renewal_reminder_sent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_plan_renewal_reminder_sent(UUID) TO service_role;

-- Downgrade limpa expiração
CREATE OR REPLACE FUNCTION public.downgrade_user_plan(p_target public.user_plan)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_current public.user_plan;
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

  IF public.plan_order(p_target) >= public.plan_order(v_current) THEN
    RAISE EXCEPTION 'Use o checkout para fazer upgrade de plano';
  END IF;

  IF NOT public.can_downgrade_to_plan(v_uid, p_target) THEN
    RAISE EXCEPTION 'Reduza ou remova conteúdo extra antes de mudar para este plano (comunidades, clube, quadras ou anúncio de aulas)';
  END IF;

  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET
    plan = p_target,
    plan_expires_at = CASE WHEN p_target = 'free'::public.user_plan THEN NULL ELSE plan_expires_at END,
    plan_activated_at = CASE WHEN p_target = 'free'::public.user_plan THEN NULL ELSE plan_activated_at END,
    plan_billing_mode = CASE WHEN p_target = 'free'::public.user_plan THEN NULL ELSE plan_billing_mode END,
    mp_preapproval_id = CASE WHEN p_target = 'free'::public.user_plan THEN NULL ELSE mp_preapproval_id END
  WHERE id = v_uid;

  INSERT INTO public.plan_changes (user_id, from_plan, to_plan, amount_cents, status, completed_at, provider)
  VALUES (v_uid, v_current, p_target, 0, 'completed', now(), 'manual');
END;
$$;

-- Staff set plan: 30 dias se pago
CREATE OR REPLACE FUNCTION public.staff_set_user_plan(
  p_user_id UUID,
  p_plan public.user_plan
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_staff_admin();
  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET
    plan = p_plan,
    plan_activated_at = CASE
      WHEN p_plan = 'free'::public.user_plan THEN NULL
      ELSE now()
    END,
    plan_expires_at = CASE
      WHEN p_plan = 'free'::public.user_plan THEN NULL
      ELSE now() + interval '30 days'
    END,
    plan_billing_mode = CASE
      WHEN p_plan = 'free'::public.user_plan THEN NULL
      ELSE COALESCE(plan_billing_mode, 'card_once')
    END,
    plan_renewal_reminder_sent_at = NULL
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
END;
$$;

-- get_my_plan_usage com expiração
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
  v_effective public.user_plan;
  v_active BOOLEAN;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_staff_unlimited := public.can_moderate_platform(v_uid);
  v_effective := public.effective_user_plan(v_uid);
  v_active := v_effective IS DISTINCT FROM 'free'::public.user_plan
    OR v_profile.plan = 'free'::public.user_plan;

  RETURN json_build_object(
    'plan', v_effective,
    'stored_plan', v_profile.plan,
    'plan_active', CASE
      WHEN v_staff_unlimited THEN true
      WHEN v_profile.plan = 'free'::public.user_plan THEN true
      WHEN v_profile.plan_expires_at IS NULL THEN true
      ELSE v_profile.plan_expires_at >= now()
    END,
    'plan_activated_at', v_profile.plan_activated_at,
    'plan_expires_at', v_profile.plan_expires_at,
    'plan_billing_mode', v_profile.plan_billing_mode,
    'show_plan_badge', v_profile.show_plan_badge,
    'communities_count', public.count_user_communities(v_uid, 'community'),
    'communities_max', CASE WHEN v_staff_unlimited THEN NULL ELSE public.max_communities_for_plan(v_effective) END,
    'clubs_count', public.count_user_communities(v_uid, 'club'),
    'clubs_max', CASE WHEN v_staff_unlimited THEN NULL ELSE public.max_clubs_for_plan(v_effective) END,
    'coach_listings_count', (
      SELECT COUNT(*)::INTEGER FROM public.coach_listings WHERE user_id = v_uid
    ),
    'coach_listings_max', CASE
      WHEN v_staff_unlimited OR v_effective = 'professor'::public.user_plan THEN 1
      ELSE 0
    END,
    'courts_count', public.count_user_courts_total(v_uid),
    'courts_max', CASE WHEN v_staff_unlimited THEN NULL ELSE public.max_courts_for_plan(v_effective) END,
    'can_create_coach_listing', public.user_can_create_coach_listing(v_uid),
    'can_create_club', public.user_can_create_community(v_uid, 'club'),
    'can_create_court', public.user_can_create_court(v_uid),
    'can_create_community', public.user_can_create_community(v_uid, 'community'),
    'can_create_standalone_tournament', public.user_can_create_standalone_tournament(v_uid),
    'has_feed_boost', v_effective IN (
      'professor'::public.user_plan,
      'promotor'::public.user_plan,
      'proprietario'::public.user_plan,
      'proprietario_plus'::public.user_plan
    ),
    'feed_boost_hours', CASE
      WHEN v_effective = 'professor'::public.user_plan THEN 3
      WHEN v_effective = 'promotor'::public.user_plan THEN 4
      WHEN public.is_proprietario_plan(v_effective) THEN 2
      ELSE NULL
    END
  );
END;
$$;

-- Gates usam plano efetivo (expirado = free)
CREATE OR REPLACE FUNCTION public.user_can_create_coach_listing(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_moderate_platform(p_user_id)
    OR (
      public.effective_user_plan(p_user_id) = 'professor'::public.user_plan
      AND (
        SELECT COUNT(*)::INTEGER FROM public.coach_listings WHERE user_id = p_user_id
      ) < 1
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_standalone_tournament(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_moderate_platform(p_user_id)
    OR public.effective_user_plan(p_user_id) = 'promotor'::public.user_plan;
$$;

GRANT EXECUTE ON FUNCTION public.staff_set_user_plan(UUID, public.user_plan) TO authenticated;
GRANT EXECUTE ON FUNCTION public.downgrade_user_plan(public.user_plan) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_plan_usage() TO authenticated;

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

  v_plan := public.effective_user_plan(p_user_id);

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

  v_plan := public.effective_user_plan(p_user_id);
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

