-- Bio do perfil: limite de 280 caracteres

UPDATE public.profiles
SET bio = left(bio, 280)
WHERE char_length(bio) > 280;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_max;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_max CHECK (char_length(bio) <= 280);

COMMENT ON COLUMN public.profiles.bio IS 'Biografia pública do usuário (máx. 280 caracteres)';
