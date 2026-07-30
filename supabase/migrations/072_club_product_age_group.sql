-- Público-alvo do produto da loja do clube (define opções de tamanho/numeração).

ALTER TABLE public.club_products
  ADD COLUMN IF NOT EXISTS age_group TEXT NOT NULL DEFAULT 'adulto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_products_age_group_check'
  ) THEN
    ALTER TABLE public.club_products
      ADD CONSTRAINT club_products_age_group_check
      CHECK (age_group IN ('adulto', 'infantil'));
  END IF;
END $$;
