-- Clube e localização direta nas divulgações de professor (Aprenda à Jogar)

ALTER TABLE public.coach_listings
  ADD COLUMN IF NOT EXISTS club_name TEXT,
  ADD COLUMN IF NOT EXISTS location_label TEXT;

COMMENT ON COLUMN public.coach_listings.club_name IS
  'Clube ou academia onde o professor dá aulas (texto livre).';

COMMENT ON COLUMN public.coach_listings.location_label IS
  'Localização direta (cidade, bairro, endereço ou região).';

-- Exigir localização em novos cadastros; clubes existentes podem ficar vazios até editar
ALTER TABLE public.coach_listings
  DROP CONSTRAINT IF EXISTS coach_listings_location_label_len;

ALTER TABLE public.coach_listings
  ADD CONSTRAINT coach_listings_location_label_len
  CHECK (location_label IS NULL OR char_length(trim(location_label)) >= 2);

ALTER TABLE public.coach_listings
  DROP CONSTRAINT IF EXISTS coach_listings_club_name_len;

ALTER TABLE public.coach_listings
  ADD CONSTRAINT coach_listings_club_name_len
  CHECK (club_name IS NULL OR char_length(trim(club_name)) >= 2);
