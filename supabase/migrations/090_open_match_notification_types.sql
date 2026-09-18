-- Enum values for open match management notifications.
-- Must commit before referencing in function bodies (PG rule).

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'open_match_cancelled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'open_match_removed';
