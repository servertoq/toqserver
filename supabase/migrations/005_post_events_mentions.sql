-- =============================================================================
-- Toq Tennis — Data/hora de eventos e menções em posts
-- =============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS event_time TIME;

COMMENT ON COLUMN public.posts.event_date IS 'Data opcional do evento';
COMMENT ON COLUMN public.posts.event_time IS 'Horário opcional do evento';

-- -----------------------------------------------------------------------------
-- Menções (@username)
-- -----------------------------------------------------------------------------
CREATE TABLE public.post_mentions (
  post_id           UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, mentioned_user_id)
);

CREATE INDEX post_mentions_user_id_idx ON public.post_mentions (mentioned_user_id);

-- -----------------------------------------------------------------------------
-- Resolver usernames mencionados
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_ids_by_usernames(p_usernames TEXT[])
RETURNS TABLE(id UUID, username TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username
  FROM public.profiles p
  WHERE LOWER(p.username) = ANY (
    SELECT LOWER(TRIM(u))
    FROM unnest(p_usernames) AS u
    WHERE TRIM(u) <> ''
  );
$$;

REVOKE ALL ON FUNCTION public.get_profile_ids_by_usernames(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_ids_by_usernames(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_profiles_for_mention(p_query TEXT, p_limit INT DEFAULT 8)
RETURNS TABLE(id UUID, username TEXT, avatar_url TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.avatar_url
  FROM public.profiles p
  WHERE LENGTH(TRIM(p_query)) >= 1
    AND p.username ILIKE TRIM(p_query) || '%'
  ORDER BY p.username
  LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

REVOKE ALL ON FUNCTION public.search_profiles_for_mention(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles_for_mention(TEXT, INT) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS — post_mentions
-- -----------------------------------------------------------------------------
ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menções visíveis com o post"
  ON public.post_mentions FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

CREATE POLICY "Autor registra menções no próprio post"
  ON public.post_mentions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  );
