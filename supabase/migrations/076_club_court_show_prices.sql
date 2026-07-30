-- Opção de ocultar valores no anúncio da quadra do clube
-- Idempotente

ALTER TABLE public.club_courts
  ADD COLUMN IF NOT EXISTS show_prices BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.club_courts.show_prices IS
  'Se false, oculta preços nas listagens/feed; planos e reserva continuam com valores.';
