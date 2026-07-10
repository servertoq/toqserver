-- Corrige falso positivo ao confirmar pagamento: reserva awaiting_payment sem block
-- ainda não ocupa a agenda e não deve bloquear a criação do horário.

CREATE OR REPLACE FUNCTION public.club_court_blocks_prevent_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.club_court_blocks b
    WHERE b.court_id = NEW.court_id
      AND b.id IS DISTINCT FROM NEW.id
      AND b.start_ts < NEW.end_ts
      AND b.end_ts > NEW.start_ts
  ) THEN
    RAISE EXCEPTION 'Horário já reservado para esta quadra neste dia.';
  END IF;

  IF to_regclass('public.club_court_bookings') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.club_court_bookings bk
      WHERE bk.club_court_id = NEW.court_id
        AND bk.status IN ('confirmed', 'completed')
        AND (bk.block_id IS NULL OR bk.block_id IS DISTINCT FROM NEW.id)
        AND bk.booking_date + bk.start_time < NEW.end_ts
        AND bk.booking_date + bk.end_time > NEW.start_ts
    ) THEN
      RAISE EXCEPTION 'Horário já reservado para esta quadra neste dia.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
