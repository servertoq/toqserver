-- Conclusão de aula: presença por aluno convidado + relatório da sessão.

ALTER TABLE public.coach_scheduled_lessons
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed')),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_report TEXT
    CHECK (session_report IS NULL OR char_length(session_report) <= 3000);

ALTER TABLE public.coach_lesson_attendees
  ADD COLUMN IF NOT EXISTS attended BOOLEAN;

COMMENT ON COLUMN public.coach_lesson_attendees.attended IS
  'Presença marcada ao concluir a aula. NULL = ainda não registrada.';

CREATE OR REPLACE FUNCTION public.coach_complete_lesson(
  p_lesson_id UUID,
  p_session_report TEXT,
  p_attendance JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lesson public.coach_scheduled_lessons%ROWTYPE;
  v_item JSONB;
  v_student_id UUID;
  v_attended BOOLEAN;
  v_expected INTEGER;
  v_marked INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_lesson
  FROM public.coach_scheduled_lessons
  WHERE id = p_lesson_id AND coach_id = v_uid;

  IF v_lesson.id IS NULL THEN
    RAISE EXCEPTION 'Aula não encontrada';
  END IF;

  IF v_lesson.status = 'completed' THEN
    RAISE EXCEPTION 'Esta aula já foi concluída';
  END IF;

  IF p_attendance IS NULL OR jsonb_typeof(p_attendance) <> 'array' OR jsonb_array_length(p_attendance) = 0 THEN
    RAISE EXCEPTION 'Marque a presença dos alunos convidados';
  END IF;

  IF p_session_report IS NULL OR char_length(trim(p_session_report)) < 10 THEN
    RAISE EXCEPTION 'O relatório da aula precisa ter pelo menos 10 caracteres';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_expected
  FROM public.coach_lesson_attendees
  WHERE lesson_id = p_lesson_id;

  v_marked := 0;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_attendance) LOOP
    v_student_id := (v_item->>'student_id')::UUID;
    v_attended := COALESCE((v_item->>'attended')::BOOLEAN, false);

    IF v_student_id IS NULL THEN
      RAISE EXCEPTION 'Registro de presença inválido';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.coach_lesson_attendees
      WHERE lesson_id = p_lesson_id AND student_id = v_student_id
    ) THEN
      RAISE EXCEPTION 'Aluno não foi convidado para esta aula';
    END IF;

    UPDATE public.coach_lesson_attendees
    SET attended = v_attended
    WHERE lesson_id = p_lesson_id AND student_id = v_student_id;

    v_marked := v_marked + 1;
  END LOOP;

  IF v_marked <> v_expected THEN
    RAISE EXCEPTION 'Marque a presença de todos os alunos convidados para esta aula';
  END IF;

  UPDATE public.coach_scheduled_lessons
  SET
    status = 'completed',
    completed_at = now(),
    session_report = trim(p_session_report)
  WHERE id = p_lesson_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coach_complete_lesson(UUID, TEXT, JSONB) TO authenticated;
