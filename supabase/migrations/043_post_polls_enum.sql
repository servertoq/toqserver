-- Passo 1: novo valor no enum (deve ser commitado antes de ser referenciado)

ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'poll';
