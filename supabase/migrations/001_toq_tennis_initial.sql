-- =============================================================================
-- Toq Tennis — Schema inicial (Supabase)
-- Execute no SQL Editor do Supabase ou via: supabase db push
-- =============================================================================

-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
CREATE TYPE public.gender_type AS ENUM ('masculino', 'feminino', 'outro');

-- -----------------------------------------------------------------------------
-- Tabela de perfis (estende auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT NOT NULL,
  email         TEXT NOT NULL,
  avatar_url    TEXT,
  birth_date    DATE NOT NULL,
  gender        public.gender_type NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT profiles_username_length CHECK (char_length(username) >= 3),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  CONSTRAINT profiles_email_format CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (LOWER(username));
CREATE UNIQUE INDEX profiles_email_lower_idx ON public.profiles (LOWER(email));

COMMENT ON TABLE public.profiles IS 'Perfil público do usuário Toq Tennis';
COMMENT ON COLUMN public.profiles.username IS 'Nome de usuário único para login';

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Resolver e-mail por username (login com nome de usuário)
-- Apenas retorna o e-mail — necessário para signInWithPassword no cliente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE LOWER(username) = LOWER(TRIM(p_username))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Verificar disponibilidade de username (cadastro)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE LOWER(username) = LOWER(TRIM(p_username))
  );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Trigger: criar perfil após cadastro no Auth
-- Metadados enviados no signUp: username, birth_date, gender, avatar_url
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
BEGIN
  v_username := NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), '');
  v_birth_date := (NEW.raw_user_meta_data->>'birth_date')::DATE;
  v_gender := (NEW.raw_user_meta_data->>'gender')::public.gender_type;
  v_avatar_url := NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), '');

  -- Cadastro por e-mail envia metadados completos; Google OAuth usa valores padrão
  IF v_username IS NULL THEN
    v_username := LOWER(REGEXP_REPLACE(
      SPLIT_PART(COALESCE(NEW.email, 'usuario'), '@', 1),
      '[^a-zA-Z0-9_]', '_', 'g'
    )) || '_' || SUBSTR(REPLACE(NEW.id::TEXT, '-', ''), 1, 6);
  END IF;

  IF v_birth_date IS NULL THEN
    v_birth_date := '2000-01-01';
  END IF;

  IF v_gender IS NULL THEN
    v_gender := 'outro';
  END IF;

  INSERT INTO public.profiles (id, username, email, birth_date, gender, avatar_url)
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    v_birth_date,
    v_gender,
    v_avatar_url
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS — profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa autenticada pode ver perfis (rede social)
CREATE POLICY "Perfis visíveis para usuários autenticados"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Usuário anônimo não lê perfis diretamente (use as RPCs acima)
-- Dono pode atualizar o próprio perfil
CREATE POLICY "Usuário atualiza próprio perfil"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Inserção feita pelo trigger SECURITY DEFINER (sem policy INSERT para authenticated)

-- -----------------------------------------------------------------------------
-- Storage — bucket de avatares
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- RLS — storage.objects (avatars)
-- -----------------------------------------------------------------------------
CREATE POLICY "Avatares públicos para leitura"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Usuário faz upload do próprio avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Usuário atualiza próprio avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Usuário remove próprio avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- =============================================================================
-- PÓS-INSTALAÇÃO (painel Supabase — não é SQL):
-- 1. Authentication → Providers → habilitar Google
-- 2. Authentication → URL Configuration → Site URL e Redirect URLs do app
-- 3. Authentication → Email → confirmar se exige verificação de e-mail
-- =============================================================================
