-- Novo post_type e notification_type (commit antes de referenciar)

ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'partida';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'match_interest';
