-- =============================================================================
-- Protege colunas privilegiadas em profiles (plan / ban)
--
-- Problema: a policy "Usuário atualiza próprio perfil" permitia PATCH direto
-- em plan / is_banned com a anon key + JWT.
--
-- Solução: BEFORE UPDATE bloqueia essas colunas, exceto:
--   1) JWT service_role (webhook Stripe / admin server)
--   2) GUC app.allow_privileged_profile_update = '1' (RPCs confiáveis)
--
-- NÃO altera dados existentes. Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Trigger de proteção
-- -----------------------------------------------------------------------------

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

  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Alteração de plano não permitida por esta via'
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

DROP TRIGGER IF EXISTS profiles_protect_privileged_columns ON public.profiles;
CREATE TRIGGER profiles_protect_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_privileged_columns();

REVOKE ALL ON FUNCTION public.protect_profiles_privileged_columns() FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- RPCs confiáveis: liberam o GUC só na transação atual
-- -----------------------------------------------------------------------------

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
  UPDATE public.profiles SET plan = p_plan WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_ban_user(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode banir a si mesmo';
  END IF;
  IF public.is_staff_admin(p_user_id) THEN
    RAISE EXCEPTION 'Não é possível banir administradores';
  END IF;

  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET
    is_banned = true,
    banned_at = now(),
    banned_reason = NULLIF(trim(p_reason), '')
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_unban_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET is_banned = false, banned_at = NULL, banned_reason = NULL
  WHERE id = p_user_id;
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

  PERFORM set_config('app.allow_privileged_profile_update', '1', true);

  UPDATE public.profiles
  SET plan = v_row.to_plan
  WHERE id = v_row.user_id;

  UPDATE public.plan_changes
  SET status = 'completed', completed_at = now()
  WHERE id = p_change_id;
END;
$$;

-- Só o backend (service_role) conclui upgrade — não o browser
REVOKE ALL ON FUNCTION public.complete_plan_upgrade(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_plan_upgrade(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.complete_plan_upgrade(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_plan_upgrade(UUID, TEXT) TO service_role;

-- Grants das demais RPCs (idempotente; mesmas permissões de antes)
GRANT EXECUTE ON FUNCTION public.staff_set_user_plan(UUID, public.user_plan) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_ban_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_unban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.downgrade_user_plan(public.user_plan) TO authenticated;
