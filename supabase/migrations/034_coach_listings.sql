-- =============================================================================
-- Aprenda à Jogar — divulgação de professores de tênis
-- Idempotente
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
  description      TEXT NOT NULL CHECK (char_length(trim(description)) >= 10),
  price_label      TEXT NOT NULL CHECK (char_length(trim(price_label)) >= 1),
  contact_whatsapp TEXT NOT NULL,
  post_id          UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coach_listings_whatsapp_len CHECK (
    char_length(regexp_replace(contact_whatsapp, '\D', '', 'g')) >= 10
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_listings_user_id_uidx
  ON public.coach_listings (user_id);

CREATE INDEX IF NOT EXISTS coach_listings_created_at_idx
  ON public.coach_listings (created_at DESC);

CREATE INDEX IF NOT EXISTS coach_listings_active_idx
  ON public.coach_listings (is_active, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_coach_listings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_listings_updated_at ON public.coach_listings;
CREATE TRIGGER coach_listings_updated_at
  BEFORE UPDATE ON public.coach_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_coach_listings_updated_at();

ALTER TABLE public.coach_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Listagens de professor visíveis" ON public.coach_listings;
CREATE POLICY "Listagens de professor visíveis"
  ON public.coach_listings FOR SELECT TO authenticated
  USING (is_active = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário divulga aulas" ON public.coach_listings;
CREATE POLICY "Usuário divulga aulas"
  ON public.coach_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário edita própria divulgação" ON public.coach_listings;
CREATE POLICY "Usuário edita própria divulgação"
  ON public.coach_listings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário exclui própria divulgação" ON public.coach_listings;
CREATE POLICY "Usuário exclui própria divulgação"
  ON public.coach_listings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
