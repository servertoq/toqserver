-- Corrige recursão infinita entre RLS de coach_scheduled_lessons e coach_lesson_attendees.

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

GRANT EXECUTE ON FUNCTION public.user_is_coach_lesson_attendee(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_coach_lesson(UUID, UUID) TO authenticated;
