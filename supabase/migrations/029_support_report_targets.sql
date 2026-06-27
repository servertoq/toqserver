-- Denúncias vinculadas a publicação, perfil ou comunidade/clube

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS target_type TEXT
    CHECK (target_type IS NULL OR target_type IN ('post', 'profile', 'community')),
  ADD COLUMN IF NOT EXISTS target_id UUID;

CREATE INDEX IF NOT EXISTS support_tickets_target_idx
  ON public.support_tickets (target_type, target_id)
  WHERE target_type IS NOT NULL;

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_target_report_chk;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_target_report_chk
  CHECK (
    (target_type IS NULL AND target_id IS NULL)
    OR (target_type IS NOT NULL AND target_id IS NOT NULL AND topic = 'report')
  );
