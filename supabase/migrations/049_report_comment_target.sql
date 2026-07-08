-- Permite denunciar comentários (e respostas) via support_tickets

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_target_type_check;

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_target_report_chk;

-- Remove qualquer CHECK legado sobre target_type (nome automático pode variar)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'support_tickets'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%target_type%'
      AND pg_get_constraintdef(c.oid) ILIKE '%post%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%comment%'
  LOOP
    EXECUTE format('ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_target_type_check
  CHECK (
    target_type IS NULL
    OR target_type IN ('post', 'profile', 'community', 'comment')
  );

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_target_report_chk
  CHECK (
    (target_type IS NULL AND target_id IS NULL)
    OR (target_type IS NOT NULL AND target_id IS NOT NULL AND topic = 'report')
  );
