-- =============================================================================
-- Perfil incompleto após Google OAuth: obrigar username + nascimento
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.profile_complete IS
  'false = precisa completar username/nascimento (ex.: 1º login Google)';

-- -----------------------------------------------------------------------------
-- handle_new_user: e-mail com meta completa → complete; Google → incomplete
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username   TEXT;
  v_birth_date DATE;
  v_gender     public.gender_type;
  v_avatar_url TEXT;
  v_complete   BOOLEAN;
BEGIN
  v_username := NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), '');
  BEGIN
    v_birth_date := (NEW.raw_user_meta_data->>'birth_date')::DATE;
  EXCEPTION WHEN others THEN
    v_birth_date := NULL;
  END;
  BEGIN
    v_gender := (NEW.raw_user_meta_data->>'gender')::public.gender_type;
  EXCEPTION WHEN others THEN
    v_gender := NULL;
  END;
  v_avatar_url := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  )), '');

  v_complete := (v_username IS NOT NULL AND v_birth_date IS NOT NULL);

  IF v_username IS NULL THEN
    v_username := LOWER(REGEXP_REPLACE(
      SPLIT_PART(COALESCE(NEW.email, 'usuario'), '@', 1),
      '[^a-zA-Z0-9_]', '_', 'g'
    )) || '_' || SUBSTR(REPLACE(NEW.id::TEXT, '-', ''), 1, 6);
  END IF;

  IF char_length(v_username) < 3 THEN
    v_username := 'user_' || SUBSTR(REPLACE(NEW.id::TEXT, '-', ''), 1, 8);
  END IF;

  IF v_birth_date IS NULL THEN
    v_birth_date := '2000-01-01';
  END IF;

  IF v_gender IS NULL THEN
    v_gender := 'outro';
  END IF;

  INSERT INTO public.profiles (id, username, email, birth_date, gender, avatar_url, profile_complete)
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    v_birth_date,
    v_gender,
    v_avatar_url,
    v_complete
  );

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: completar cadastro (Google)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_profile_setup(
  p_username TEXT,
  p_birth_date DATE,
  p_gender public.gender_type DEFAULT 'outro'::public.gender_type
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_username TEXT;
  v_already BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT profile_complete INTO v_already FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;
  IF v_already THEN
    RETURN;
  END IF;

  v_username := LOWER(TRIM(p_username));
  IF v_username IS NULL OR v_username !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'Nome de usuário inválido (3–30 caracteres: letras, números e _)';
  END IF;

  IF p_birth_date IS NULL OR p_birth_date > CURRENT_DATE OR p_birth_date < DATE '1920-01-01' THEN
    RAISE EXCEPTION 'Data de nascimento inválida';
  END IF;

  IF p_gender IS NULL THEN
    RAISE EXCEPTION 'Sexo inválido';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(username) = v_username AND id <> v_uid
  ) THEN
    RAISE EXCEPTION 'Este nome de usuário já está em uso';
  END IF;

  PERFORM set_config('app.allow_privileged_profile_update', '1', true);

  UPDATE public.profiles
  SET
    username = v_username,
    birth_date = p_birth_date,
    gender = p_gender,
    profile_complete = true
  WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_profile_setup(TEXT, DATE, public.gender_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_profile_setup(TEXT, DATE, public.gender_type) TO authenticated;

-- -----------------------------------------------------------------------------
-- Proteger profile_complete contra UPDATE direto
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

  IF NEW.profile_complete IS DISTINCT FROM OLD.profile_complete THEN
    RAISE EXCEPTION 'Alteração de profile_complete não permitida por esta via'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
