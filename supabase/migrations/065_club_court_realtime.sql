-- =============================================================================
-- Toq Tennis — Realtime para agenda e agendamento de quadras de clube
-- =============================================================================

ALTER TABLE public.club_court_blocks REPLICA IDENTITY FULL;
ALTER TABLE public.club_court_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.club_courts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'club_court_blocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.club_court_blocks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'club_court_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.club_court_bookings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'club_courts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.club_courts;
  END IF;
END $$;
