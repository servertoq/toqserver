-- Novos valores do enum user_plan (transação separada — commit antes de usar).
ALTER TYPE public.user_plan ADD VALUE IF NOT EXISTS 'promotor';
