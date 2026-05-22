-- =============================================================================
-- Toq Tennis — Visibilidade de posts e amizades
-- =============================================================================

CREATE TYPE public.post_visibility AS ENUM ('public', 'private');

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility public.post_visibility NOT NULL DEFAULT 'public';

CREATE INDEX posts_visibility_idx ON public.posts (visibility);

-- -----------------------------------------------------------------------------
-- Amizades (quem adicionou quem — user_id adicionou friend_id)
-- -----------------------------------------------------------------------------
CREATE TABLE public.friendships (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CONSTRAINT friendships_no_self CHECK (user_id <> friend_id)
);

CREATE INDEX friendships_friend_id_idx ON public.friendships (friend_id);

COMMENT ON TABLE public.friendships IS
  'user_id adicionou friend_id como amigo; posts privados do feed geral são visíveis para quem adicionou o autor';

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_friend_of_author(p_author_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE user_id = auth.uid() AND friend_id = p_author_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_friend_of_author(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_friend_of_author(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = p_post_id
      AND (
        p.author_id = auth.uid()
        OR (
          p.community_id IS NOT NULL
          AND public.is_community_member(p.community_id, auth.uid())
        )
        OR (
          p.community_id IS NOT NULL
          AND p.visibility = 'public'::public.post_visibility
        )
        OR (
          p.community_id IS NULL
          AND p.visibility = 'public'::public.post_visibility
        )
        OR (
          p.community_id IS NULL
          AND p.visibility = 'private'::public.post_visibility
          AND public.is_friend_of_author(p.author_id)
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS — friendships
-- -----------------------------------------------------------------------------
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê próprias amizades"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Usuário adiciona amigo"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário remove amizade que criou"
  ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RLS — posts (visibilidade)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Posts visíveis conforme comunidade" ON public.posts;

CREATE POLICY "Posts visíveis conforme visibilidade"
  ON public.posts FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR (
      community_id IS NOT NULL
      AND public.is_community_member(community_id, auth.uid())
    )
    OR (
      community_id IS NOT NULL
      AND visibility = 'public'::public.post_visibility
    )
    OR (
      community_id IS NULL
      AND visibility = 'public'::public.post_visibility
    )
    OR (
      community_id IS NULL
      AND visibility = 'private'::public.post_visibility
      AND public.is_friend_of_author(author_id)
    )
  );
