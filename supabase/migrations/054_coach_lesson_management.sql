-- =============================================================================
-- Gestão de Aulas: inscrições, leads/alunos, aulas agendadas, agenda e notificações
-- Idempotente
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.coach_enrollment_status AS ENUM ('lead', 'student');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'coach_new_enrollment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'coach_lesson_scheduled';

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_listing_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_listing_id UUID NOT NULL REFERENCES public.coach_listings(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_phone    TEXT,
  contact_email    TEXT,
  status           public.coach_enrollment_status NOT NULL DEFAULT 'lead',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coach_enrollment_contact CHECK (
    contact_phone IS NOT NULL OR contact_email IS NOT NULL
  ),
  CONSTRAINT coach_enrollment_unique UNIQUE (coach_listing_id, student_id)
);

CREATE INDEX IF NOT EXISTS coach_listing_enrollments_listing_idx
  ON public.coach_listing_enrollments (coach_listing_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_listing_enrollments_student_idx
  ON public.coach_listing_enrollments (student_id);

CREATE TABLE IF NOT EXISTS public.coach_scheduled_lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_listing_id UUID NOT NULL REFERENCES public.coach_listings(id) ON DELETE CASCADE,
  theme            TEXT NOT NULL CHECK (char_length(trim(theme)) >= 2),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  lesson_date      DATE NOT NULL,
  lesson_time      TIME NOT NULL,
  lesson_format    TEXT NOT NULL CHECK (lesson_format IN ('presencial', 'online', 'clube', 'outro')),
  location_detail  TEXT,
  notes            TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_scheduled_lessons_coach_idx
  ON public.coach_scheduled_lessons (coach_id, lesson_date DESC, lesson_time DESC);

CREATE TABLE IF NOT EXISTS public.coach_lesson_attendees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID NOT NULL REFERENCES public.coach_scheduled_lessons(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES public.coach_listing_enrollments(id) ON DELETE SET NULL,
  agenda_event_id UUID REFERENCES public.user_agenda_events(id) ON DELETE SET NULL,
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coach_lesson_attendee_unique UNIQUE (lesson_id, student_id)
);

CREATE INDEX IF NOT EXISTS coach_lesson_attendees_student_idx
  ON public.coach_lesson_attendees (student_id);

ALTER TABLE public.user_agenda_events
  ADD COLUMN IF NOT EXISTS coach_lesson_id UUID REFERENCES public.coach_scheduled_lessons(id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS coach_lesson_id UUID REFERENCES public.coach_scheduled_lessons(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- Triggers updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_coach_enrollments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_listing_enrollments_updated_at ON public.coach_listing_enrollments;
CREATE TRIGGER coach_listing_enrollments_updated_at
  BEFORE UPDATE ON public.coach_listing_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_coach_enrollments_updated_at();

CREATE OR REPLACE FUNCTION public.set_coach_scheduled_lessons_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_scheduled_lessons_updated_at ON public.coach_scheduled_lessons;
CREATE TRIGGER coach_scheduled_lessons_updated_at
  BEFORE UPDATE ON public.coach_scheduled_lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_coach_scheduled_lessons_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.coach_listing_owner_id(p_listing_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.coach_listings WHERE id = p_listing_id;
$$;

CREATE OR REPLACE FUNCTION public.user_owns_coach_listing(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_listings WHERE user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_coach_enrollments(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_listing_enrollments e
    JOIN public.coach_listings l ON l.id = e.coach_listing_id
    WHERE l.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_coach_management(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_owns_coach_listing(p_user_id);
$$;

-- -----------------------------------------------------------------------------
-- Inscrição (lead)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enroll_in_coach_listing(
  p_listing_id UUID,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owner UUID;
  v_phone TEXT;
  v_email TEXT;
  v_id UUID;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT user_id INTO v_owner
  FROM public.coach_listings
  WHERE id = p_listing_id AND is_active = true;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Divulgação não encontrada';
  END IF;

  IF v_owner = v_uid THEN
    RAISE EXCEPTION 'Você não pode se inscrever na própria divulgação';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;

  v_phone := NULLIF(regexp_replace(COALESCE(p_contact_phone, ''), '\D', '', 'g'), '');
  v_email := NULLIF(lower(trim(COALESCE(p_contact_email, v_profile.email, ''))), '');

  IF v_phone IS NULL AND v_email IS NULL THEN
    RAISE EXCEPTION 'Informe telefone ou e-mail para contato';
  END IF;

  IF v_phone IS NOT NULL AND char_length(v_phone) < 10 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  INSERT INTO public.coach_listing_enrollments (
    coach_listing_id, student_id, contact_phone, contact_email, status
  )
  VALUES (
    p_listing_id, v_uid, v_phone, v_email, 'lead'::public.coach_enrollment_status
  )
  ON CONFLICT (coach_listing_id, student_id) DO UPDATE
  SET
    contact_phone = EXCLUDED.contact_phone,
    contact_email = EXCLUDED.contact_email,
    updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.notifications (recipient_id, actor_id, type)
  VALUES (v_owner, v_uid, 'coach_new_enrollment'::public.notification_type);

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Gestão de leads / alunos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.coach_update_enrollment_status(
  p_enrollment_id UUID,
  p_status public.coach_enrollment_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owner UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT l.user_id INTO v_owner
  FROM public.coach_listing_enrollments e
  JOIN public.coach_listings l ON l.id = e.coach_listing_id
  WHERE e.id = p_enrollment_id;

  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.coach_listing_enrollments
  SET status = p_status
  WHERE id = p_enrollment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_remove_enrollment(p_enrollment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owner UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT l.user_id INTO v_owner
  FROM public.coach_listing_enrollments e
  JOIN public.coach_listings l ON l.id = e.coach_listing_id
  WHERE e.id = p_enrollment_id;

  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  DELETE FROM public.coach_listing_enrollments WHERE id = p_enrollment_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Agendar aula + agenda do aluno + notificação
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.coach_create_scheduled_lesson(
  p_listing_id UUID,
  p_theme TEXT,
  p_duration_minutes INTEGER,
  p_lesson_date DATE,
  p_lesson_time TIME,
  p_lesson_format TEXT,
  p_location_detail TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_student_ids UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_listing public.coach_listings%ROWTYPE;
  v_lesson_id UUID;
  v_student_id UUID;
  v_enrollment_id UUID;
  v_agenda_id UUID;
  v_notes TEXT;
  v_format_label TEXT;
  v_coach_username TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_listing
  FROM public.coach_listings
  WHERE id = p_listing_id AND user_id = v_uid;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'Divulgação não encontrada';
  END IF;

  IF p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um aluno';
  END IF;

  SELECT username INTO v_coach_username FROM public.profiles WHERE id = v_uid;

  v_format_label := CASE p_lesson_format
    WHEN 'presencial' THEN 'Presencial'
    WHEN 'online' THEN 'Online'
    WHEN 'clube' THEN 'Clube / quadra'
    ELSE 'Outro'
  END;

  INSERT INTO public.coach_scheduled_lessons (
    coach_id, coach_listing_id, theme, duration_minutes,
    lesson_date, lesson_time, lesson_format, location_detail, notes
  )
  VALUES (
    v_uid, p_listing_id, trim(p_theme), p_duration_minutes,
    p_lesson_date, p_lesson_time, p_lesson_format,
    NULLIF(trim(p_location_detail), ''),
    NULLIF(trim(p_notes), '')
  )
  RETURNING id INTO v_lesson_id;

  FOREACH v_student_id IN ARRAY p_student_ids LOOP
    SELECT e.id INTO v_enrollment_id
    FROM public.coach_listing_enrollments e
    WHERE e.coach_listing_id = p_listing_id
      AND e.student_id = v_student_id
      AND e.status IN ('lead'::public.coach_enrollment_status, 'student'::public.coach_enrollment_status);

    IF v_enrollment_id IS NULL THEN
      RAISE EXCEPTION 'Aluno não inscrito nesta divulgação';
    END IF;

    v_notes := format(
      'Professor: @%s%nFormato: %s%nDuração: %s min%nLocal: %s',
      COALESCE(v_coach_username, 'professor'),
      v_format_label,
      p_duration_minutes::TEXT,
      COALESCE(NULLIF(trim(p_location_detail), ''), 'A combinar')
    );

    IF p_notes IS NOT NULL AND trim(p_notes) <> '' THEN
      v_notes := v_notes || E'\n' || trim(p_notes);
    END IF;

    INSERT INTO public.user_agenda_events (
      user_id, event_date, event_time, event_type, title, notes, coach_lesson_id
    )
    VALUES (
      v_student_id, p_lesson_date, p_lesson_time, 'aula', trim(p_theme), v_notes, v_lesson_id
    )
    RETURNING id INTO v_agenda_id;

    INSERT INTO public.coach_lesson_attendees (
      lesson_id, student_id, enrollment_id, agenda_event_id, notified_at
    )
    VALUES (
      v_lesson_id, v_student_id, v_enrollment_id, v_agenda_id, now()
    );

    INSERT INTO public.notifications (recipient_id, actor_id, type, coach_lesson_id)
    VALUES (
      v_student_id, v_uid, 'coach_lesson_scheduled'::public.notification_type, v_lesson_id
    );
  END LOOP;

  RETURN v_lesson_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_is_coach_lesson_attendee(
  p_lesson_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_lesson_attendees
    WHERE lesson_id = p_lesson_id
      AND student_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_coach_lesson(
  p_lesson_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_scheduled_lessons
    WHERE id = p_lesson_id
      AND coach_id = p_user_id
  );
$$;

ALTER TABLE public.coach_listing_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_scheduled_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_lesson_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inscrições visíveis para aluno e professor" ON public.coach_listing_enrollments;
CREATE POLICY "Inscrições visíveis para aluno e professor"
  ON public.coach_listing_enrollments FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.coach_listings l
      WHERE l.id = coach_listing_id AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Aluno se inscreve" ON public.coach_listing_enrollments;
CREATE POLICY "Aluno se inscreve"
  ON public.coach_listing_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Aulas agendadas visíveis" ON public.coach_scheduled_lessons;
CREATE POLICY "Aulas agendadas visíveis"
  ON public.coach_scheduled_lessons FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR public.user_is_coach_lesson_attendee(id, auth.uid())
  );

DROP POLICY IF EXISTS "Participantes da aula visíveis" ON public.coach_lesson_attendees;
CREATE POLICY "Participantes da aula visíveis"
  ON public.coach_lesson_attendees FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.user_owns_coach_lesson(lesson_id, auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.enroll_in_coach_listing(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_update_enrollment_status(UUID, public.coach_enrollment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_remove_enrollment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_create_scheduled_lesson(UUID, TEXT, INTEGER, DATE, TIME, TEXT, TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_coach_management(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_coach_listing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_coach_enrollments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_coach_lesson_attendee(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_coach_lesson(UUID, UUID) TO authenticated;
