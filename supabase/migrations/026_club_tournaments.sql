-- =============================================================================
-- Toq Tennis — Torneios de clube (públicos ou só membros)
-- =============================================================================

CREATE TABLE public.club_tournaments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id     UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  how_it_works     TEXT NOT NULL DEFAULT '',
  prizes           TEXT NOT NULL DEFAULT '',
  contact_whatsapp TEXT NOT NULL,
  image_url        TEXT,
  is_private       BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_tournaments_name_len CHECK (char_length(trim(name)) >= 2),
  CONSTRAINT club_tournaments_desc_len CHECK (char_length(trim(description)) >= 10),
  CONSTRAINT club_tournaments_rules_len CHECK (char_length(trim(how_it_works)) >= 10),
  CONSTRAINT club_tournaments_prizes_len CHECK (char_length(trim(prizes)) >= 2),
  CONSTRAINT club_tournaments_phone_len CHECK (
    char_length(regexp_replace(contact_whatsapp, '\D', '', 'g')) >= 10
  ),
  CONSTRAINT club_tournaments_dates CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  )
);

CREATE INDEX club_tournaments_community_idx ON public.club_tournaments (community_id, sort_order);
CREATE INDEX club_tournaments_public_idx ON public.club_tournaments (is_active, is_private, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_club_tournaments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER club_tournaments_updated_at
  BEFORE UPDATE ON public.club_tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_club_tournaments_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.club_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Torneios visíveis conforme privacidade"
  ON public.club_tournaments FOR SELECT TO authenticated
  USING (
    public.can_moderate_community(community_id, (SELECT auth.uid()))
    OR (
      is_active = true
      AND (
        is_private = false
        OR public.is_community_member(community_id, (SELECT auth.uid()))
      )
    )
  );

CREATE POLICY "Moderadores inserem torneios"
  ON public.club_tournaments FOR INSERT TO authenticated
  WITH CHECK (public.can_moderate_community(community_id, (SELECT auth.uid())));

CREATE POLICY "Moderadores atualizam torneios"
  ON public.club_tournaments FOR UPDATE TO authenticated
  USING (public.can_moderate_community(community_id, (SELECT auth.uid())))
  WITH CHECK (public.can_moderate_community(community_id, (SELECT auth.uid())));

CREATE POLICY "Moderadores excluem torneios"
  ON public.club_tournaments FOR DELETE TO authenticated
  USING (public.can_moderate_community(community_id, (SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- Storage — imagem de divulgação
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-tournament-images',
  'club-tournament-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Imagens de torneio públicas"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'club-tournament-images');

CREATE POLICY "Moderador envia imagem de torneio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-tournament-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Moderador atualiza imagem de torneio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-tournament-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Moderador remove imagem de torneio"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-tournament-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
