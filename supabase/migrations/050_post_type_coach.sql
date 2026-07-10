-- =============================================================================
-- Toq Tennis — post_type coach (divulgação de aulas)
-- =============================================================================

ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'coach';

-- Corrige posts já publicados via coach_listings
UPDATE public.posts p
SET
  post_type = 'coach'::public.post_type,
  title = trim(cl.title),
  body = CASE
    WHEN trim(cl.price_label) = '' THEN trim(cl.description)
    ELSE trim(cl.description) || E'\n\nValor: ' || trim(cl.price_label)
  END
FROM public.coach_listings cl
WHERE cl.post_id = p.id;
