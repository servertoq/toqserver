-- =============================================================================
-- Toq Tennis — Quadras cadastradas pelos usuários
-- =============================================================================

CREATE TABLE public.courts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  size_label        TEXT NOT NULL,
  description       TEXT NOT NULL,
  cep               TEXT,
  street            TEXT,
  street_number     TEXT,
  complement        TEXT,
  neighborhood      TEXT,
  city              TEXT NOT NULL,
  state             CHAR(2) NOT NULL,
  country           TEXT NOT NULL DEFAULT 'Brasil',
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  formatted_address TEXT,
  contact_phone     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT courts_name_len CHECK (char_length(trim(name)) >= 2),
  CONSTRAINT courts_description_len CHECK (char_length(trim(description)) >= 10),
  CONSTRAINT courts_contact_len CHECK (char_length(regexp_replace(contact_phone, '\D', '', 'g')) >= 10)
);

CREATE INDEX courts_owner_id_idx ON public.courts (owner_id);
CREATE INDEX courts_city_state_idx ON public.courts (city, state);
CREATE INDEX courts_created_at_idx ON public.courts (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_courts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER courts_updated_at
  BEFORE UPDATE ON public.courts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_courts_updated_at();

ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quadras visíveis para autenticados"
  ON public.courts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuário cadastra quadra"
  ON public.courts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Dono atualiza quadra"
  ON public.courts FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Dono remove quadra"
  ON public.courts FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);
