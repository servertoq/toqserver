-- Corrige format(): Postgres não reconhece %n (use \n real).

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
      E'Professor: @%s\nFormato: %s\nDuração: %s min\nLocal: %s',
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
