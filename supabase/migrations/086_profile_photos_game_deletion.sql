-- =============================================================================
-- Perfil: fotos (até 6), atributos MEU JOGO, exclusão com grace period 30 dias
-- Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- MEU JOGO — colunas em profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dominant_hand TEXT
    CHECK (dominant_hand IS NULL OR dominant_hand IN ('direita', 'esquerda', 'ambidestra')),
  ADD COLUMN IF NOT EXISTS experience_band TEXT
    CHECK (experience_band IS NULL OR experience_band IN ('lt1', 'y1_3', 'y3_5', 'y5_plus')),
  ADD COLUMN IF NOT EXISTS play_frequency TEXT
    CHECK (play_frequency IS NULL OR play_frequency IN ('x1', 'x2_3', 'x4_6', 'x7')),
  ADD COLUMN IF NOT EXISTS play_style TEXT
    CHECK (play_style IS NULL OR play_style IN ('agressivo', 'defensivo', 'all_court', 'versatil')),
  ADD COLUMN IF NOT EXISTS favorite_court TEXT
    CHECK (favorite_court IS NULL OR favorite_court IN ('rapida', 'saibro', 'grama', 'indoor'));

-- -----------------------------------------------------------------------------
-- Exclusão de conta (grace period)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_warning_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_deletion_scheduled_idx
  ON public.profiles (deletion_scheduled_for)
  WHERE deletion_scheduled_for IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Fotos do perfil (até 6)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_photos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_photos_url_len CHECK (char_length(trim(url)) >= 8)
);

CREATE INDEX IF NOT EXISTS profile_photos_user_idx
  ON public.profile_photos (user_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION public.profile_photos_max_six()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.profile_photos
  WHERE user_id = NEW.user_id;

  IF TG_OP = 'INSERT' AND v_count >= 6 THEN
    RAISE EXCEPTION 'Limite de 6 fotos no perfil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_photos_limit ON public.profile_photos;
CREATE TRIGGER profile_photos_limit
  BEFORE INSERT ON public.profile_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.profile_photos_max_six();

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotos de perfil visíveis para autenticados" ON public.profile_photos;
CREATE POLICY "Fotos de perfil visíveis para autenticados"
  ON public.profile_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_photos.user_id
        AND p.deletion_requested_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Dono insere fotos do perfil" ON public.profile_photos;
CREATE POLICY "Dono insere fotos do perfil"
  ON public.profile_photos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Dono atualiza fotos do perfil" ON public.profile_photos;
CREATE POLICY "Dono atualiza fotos do perfil"
  ON public.profile_photos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Dono remove fotos do perfil" ON public.profile_photos;
CREATE POLICY "Dono remove fotos do perfil"
  ON public.profile_photos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- get_profile_by_username — MEU JOGO + oculta contas em exclusão
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_profile_by_username(TEXT);

CREATE FUNCTION public.get_profile_by_username(p_username TEXT)
RETURNS TABLE(
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  birth_date DATE,
  gender public.gender_type,
  player_level public.player_level_type,
  plan public.user_plan,
  created_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  address_zip TEXT,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_complement TEXT,
  address_city TEXT,
  address_state TEXT,
  dominant_hand TEXT,
  experience_band TEXT,
  play_frequency TEXT,
  play_style TEXT,
  favorite_court TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.birth_date,
    p.gender,
    p.player_level,
    p.plan,
    p.created_at,
    p.last_seen_at,
    p.address_zip,
    p.address_street,
    p.address_number,
    p.address_neighborhood,
    p.address_complement,
    p.address_city,
    p.address_state,
    p.dominant_hand,
    p.experience_band,
    p.play_frequency,
    p.play_style,
    p.favorite_court
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(TRIM(p_username))
    AND p.deletion_requested_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- Prévia de amigos (perfil público)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_friends_preview(
  p_profile_id UUID,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE(
  friend_id UUID,
  username TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.friend_id,
    pr.username,
    pr.avatar_url
  FROM public.friendships f
  JOIN public.profiles pr ON pr.id = f.friend_id
  JOIN public.profiles owner ON owner.id = f.user_id
  WHERE f.user_id = p_profile_id
    AND owner.deletion_requested_at IS NULL
    AND pr.deletion_requested_at IS NULL
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50));
$$;

REVOKE ALL ON FUNCTION public.get_profile_friends_preview(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_friends_preview(UUID, INTEGER) TO authenticated;

-- -----------------------------------------------------------------------------
-- Clubes do perfil (lista pública para match)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_clubs(p_profile_id UUID)
RETURNS TABLE(
  community_id UUID,
  name TEXT,
  slug TEXT,
  cover_image_url TEXT,
  kind public.community_kind,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.slug,
    c.cover_image_url,
    c.kind,
    cm.joined_at
  FROM public.community_members cm
  JOIN public.communities c ON c.id = cm.community_id
  JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.user_id = p_profile_id
    AND p.deletion_requested_at IS NULL
  ORDER BY cm.joined_at DESC NULLS LAST, c.name;
$$;

REVOKE ALL ON FUNCTION public.get_profile_clubs(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_clubs(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Exclusão: request / cancel
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_scheduled TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  v_scheduled := now() + INTERVAL '30 days';

  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET
    deletion_requested_at = now(),
    deletion_scheduled_for = v_scheduled,
    deletion_warning_sent_at = NULL
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  RETURN v_scheduled;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_role TEXT := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND v_role <> 'service_role' THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET
    deletion_requested_at = NULL,
    deletion_scheduled_for = NULL,
    deletion_warning_sent_at = NULL
  WHERE id = v_uid
    AND deletion_requested_at IS NOT NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_account_deletion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion(UUID) TO service_role;

-- Listagens para cron (service role)
CREATE OR REPLACE FUNCTION public.list_account_deletion_warnings()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  username TEXT,
  deletion_scheduled_for TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.username,
    p.deletion_scheduled_for
  FROM public.profiles p
  WHERE p.deletion_scheduled_for IS NOT NULL
    AND p.deletion_warning_sent_at IS NULL
    AND p.deletion_scheduled_for <= (now() + INTERVAL '2 days')
    AND p.deletion_scheduled_for > now();
$$;

CREATE OR REPLACE FUNCTION public.list_account_deletions_due()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  username TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.username
  FROM public.profiles p
  WHERE p.deletion_scheduled_for IS NOT NULL
    AND p.deletion_scheduled_for <= now();
$$;

CREATE OR REPLACE FUNCTION public.mark_account_deletion_warning_sent(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_privileged_profile_update', '1', true);
  UPDATE public.profiles
  SET deletion_warning_sent_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_account_deletion_warnings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_account_deletions_due() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_account_deletion_warning_sent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_account_deletion_warnings() TO service_role;
GRANT EXECUTE ON FUNCTION public.list_account_deletions_due() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_account_deletion_warning_sent(UUID) TO service_role;

-- -----------------------------------------------------------------------------
-- Proteger colunas de exclusão no UPDATE direto
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

  IF NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at
     OR NEW.deletion_scheduled_for IS DISTINCT FROM OLD.deletion_scheduled_for
     OR NEW.deletion_warning_sent_at IS DISTINCT FROM OLD.deletion_warning_sent_at THEN
    RAISE EXCEPTION 'Alteração de exclusão de conta não permitida por esta via'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
