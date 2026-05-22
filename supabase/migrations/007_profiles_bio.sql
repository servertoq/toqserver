-- =============================================================================
-- Toq Tennis — BIO no perfil
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_max;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_max CHECK (char_length(bio) <= 1000);

COMMENT ON COLUMN public.profiles.bio IS 'Biografia pública do usuário (máx. 1000 caracteres)';
