-- =============================================================================
-- Toq Tennis — Clube: Quadras + planos + funcionamento + agenda (bloqueios)
-- =============================================================================

CREATE TABLE public.club_courts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  size_label    TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_courts_name_len CHECK (char_length(trim(name)) >= 2),
  CONSTRAINT club_courts_desc_len CHECK (char_length(trim(description)) >= 10),
  CONSTRAINT club_courts_phone_len CHECK (char_length(regexp_replace(contact_phone, '\D', '', 'g')) >= 10)
);

CREATE INDEX club_courts_community_idx ON public.club_courts (community_id, sort_order);

CREATE OR REPLACE FUNCTION public.set_club_courts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER club_courts_updated_at
  BEFORE UPDATE ON public.club_courts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_club_courts_updated_at();

CREATE TABLE public.club_court_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id    UUID NOT NULL REFERENCES public.club_courts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX club_court_images_court_idx ON public.club_court_images (court_id, sort_order);

CREATE OR REPLACE FUNCTION public.club_court_images_max_three()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.club_court_images
  WHERE court_id = NEW.court_id;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Máximo de 3 imagens por quadra';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER club_court_images_limit
  BEFORE INSERT ON public.club_court_images
  FOR EACH ROW
  EXECUTE FUNCTION public.club_court_images_max_three();

CREATE TABLE public.club_court_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id      UUID NOT NULL REFERENCES public.club_courts(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  unit_label    TEXT NOT NULL DEFAULT 'hora',
  unit_minutes  INTEGER NOT NULL CHECK (unit_minutes > 0),
  price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX club_court_plans_court_idx ON public.club_court_plans (court_id, sort_order);

CREATE TABLE public.club_court_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id    UUID NOT NULL REFERENCES public.club_courts(id) ON DELETE CASCADE,
  weekday     SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_court_hours_valid CHECK (start_time < end_time)
);

CREATE INDEX club_court_hours_court_idx ON public.club_court_hours (court_id, weekday, start_time);

CREATE TABLE public.club_court_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id    UUID NOT NULL REFERENCES public.club_courts(id) ON DELETE CASCADE,
  start_ts    TIMESTAMPTZ NOT NULL,
  end_ts      TIMESTAMPTZ NOT NULL,
  reason      TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT club_court_blocks_valid CHECK (start_ts < end_ts)
);

CREATE INDEX club_court_blocks_court_idx ON public.club_court_blocks (court_id, start_ts);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.club_courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_court_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_court_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_court_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_court_blocks ENABLE ROW LEVEL SECURITY;

-- club_courts: membros podem ver; moderadores gerenciam
CREATE POLICY "Quadras do clube visíveis para membros"
  ON public.club_courts FOR SELECT TO authenticated
  USING (public.is_community_member(community_id, (SELECT auth.uid())));

CREATE POLICY "Moderadores gerenciam quadras do clube"
  ON public.club_courts FOR INSERT TO authenticated
  WITH CHECK (public.can_moderate_community(community_id, (SELECT auth.uid())));

CREATE POLICY "Moderadores atualizam quadras do clube"
  ON public.club_courts FOR UPDATE TO authenticated
  USING (public.can_moderate_community(community_id, (SELECT auth.uid())))
  WITH CHECK (public.can_moderate_community(community_id, (SELECT auth.uid())));

CREATE POLICY "Moderadores removem quadras do clube"
  ON public.club_courts FOR DELETE TO authenticated
  USING (public.can_moderate_community(community_id, (SELECT auth.uid())));

-- Imagens/planos/horários/bloqueios: controlados via court -> community
CREATE POLICY "Imagens de quadra visíveis para membros"
  ON public.club_court_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.is_community_member(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores gerenciam imagens de quadra"
  ON public.club_court_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores atualizam imagens de quadra"
  ON public.club_court_images FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores removem imagens de quadra"
  ON public.club_court_images FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Planos visíveis para membros"
  ON public.club_court_plans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.is_community_member(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores gerenciam planos"
  ON public.club_court_plans FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores atualizam planos"
  ON public.club_court_plans FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores removem planos"
  ON public.club_court_plans FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Funcionamento visível para membros"
  ON public.club_court_hours FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.is_community_member(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores gerenciam funcionamento"
  ON public.club_court_hours FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores removem funcionamento"
  ON public.club_court_hours FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Bloqueios visíveis para membros"
  ON public.club_court_blocks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.is_community_member(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores gerenciam bloqueios"
  ON public.club_court_blocks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores removem bloqueios"
  ON public.club_court_blocks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_courts c
      WHERE c.id = court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- Storage — imagens de quadras do clube
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-court-images',
  'club-court-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Imagens de quadra do clube — leitura pública"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'club-court-images');

CREATE POLICY "Moderador envia imagem de quadra"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-court-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Moderador atualiza imagem de quadra"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-court-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Moderador remove imagem de quadra"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-court-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

