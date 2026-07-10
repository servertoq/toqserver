-- Impede marcar o mesmo horário duas vezes na mesma quadra.

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

DROP TRIGGER IF EXISTS club_court_blocks_no_overlap ON public.club_court_blocks;
CREATE TRIGGER club_court_blocks_no_overlap
  BEFORE INSERT OR UPDATE ON public.club_court_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.club_court_blocks_prevent_overlap();
