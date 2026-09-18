-- Convidado aceita o convite → fica pending; criador ainda precisa aprovar.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'open_match_join_request';
