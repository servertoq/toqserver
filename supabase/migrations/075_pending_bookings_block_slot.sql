-- Bloquear horário também para reservas pendentes (evita double-booking)

CREATE OR REPLACE FUNCTION public.court_booking_slot_taken(
  p_court_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_court_blocks b
    WHERE b.court_id = p_court_id
      AND b.start_ts < (p_date + p_end)
      AND b.end_ts > (p_date + p_start)
  ) OR EXISTS (
    SELECT 1
    FROM public.club_court_bookings bk
    WHERE bk.club_court_id = p_court_id
      AND bk.booking_date = p_date
      AND bk.status IN ('pending', 'awaiting_payment', 'confirmed', 'completed')
      AND (p_exclude_booking_id IS NULL OR bk.id <> p_exclude_booking_id)
      AND bk.start_time < p_end
      AND bk.end_time > p_start
  );
$$;

CREATE OR REPLACE FUNCTION public.club_court_taken_ranges(
  p_court_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.can_view_club_court(p_court_id, v_uid) THEN
    RAISE EXCEPTION 'Quadra não disponível';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object('start_ts', t.start_ts, 'end_ts', t.end_ts))
      FROM (
        SELECT b.start_ts, b.end_ts
        FROM public.club_court_blocks b
        WHERE b.court_id = p_court_id
          AND b.start_ts::date <= p_date
          AND b.end_ts::date >= p_date
        UNION ALL
        SELECT
          (p_date + bk.start_time)::timestamptz AS start_ts,
          (p_date + bk.end_time)::timestamptz AS end_ts
        FROM public.club_court_bookings bk
        WHERE bk.club_court_id = p_court_id
          AND bk.booking_date = p_date
          AND bk.status IN ('pending', 'awaiting_payment', 'confirmed', 'completed')
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.court_booking_slot_taken(UUID, DATE, TIME, TIME, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.court_booking_slot_taken(UUID, DATE, TIME, TIME, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.club_court_taken_ranges(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_court_taken_ranges(UUID, DATE) TO authenticated;
