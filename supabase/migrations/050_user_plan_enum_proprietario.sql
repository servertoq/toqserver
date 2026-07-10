-- =============================================================================
-- Novos valores do enum user_plan (deve rodar em transação separada)
-- PostgreSQL exige commit antes de usar os novos valores.
-- =============================================================================

ALTER TYPE public.user_plan ADD VALUE IF NOT EXISTS 'proprietario';
ALTER TYPE public.user_plan ADD VALUE IF NOT EXISTS 'proprietario_plus';
