-- =============================================================================
-- Toq Tennis — Respostas em comentários, curtidas e menções
-- =============================================================================

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS post_comments_parent_id_idx
  ON public.post_comments (parent_id, created_at);

-- -----------------------------------------------------------------------------
-- Curtidas em comentários
-- -----------------------------------------------------------------------------
CREATE TABLE public.comment_likes (
  comment_id  UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX comment_likes_user_id_idx ON public.comment_likes (user_id);

-- -----------------------------------------------------------------------------
-- Menções em comentários
-- -----------------------------------------------------------------------------
CREATE TABLE public.comment_mentions (
  comment_id          UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  mentioned_user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, mentioned_user_id)
);

CREATE INDEX comment_mentions_user_id_idx ON public.comment_mentions (mentioned_user_id);

-- -----------------------------------------------------------------------------
-- Novos tipos de notificação
-- -----------------------------------------------------------------------------
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'comment_reply';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'comment_like';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'comment_mention';

-- -----------------------------------------------------------------------------
-- Notificações — comentários (resposta vs. comentário no post)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id UUID;
  v_parent_author_id UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN
    SELECT author_id INTO v_post_author_id FROM public.posts WHERE id = NEW.post_id;
    IF v_post_author_id IS NOT NULL AND v_post_author_id <> NEW.author_id THEN
      PERFORM public.create_notification(
        v_post_author_id, NEW.author_id, 'post_comment'::public.notification_type,
        NEW.post_id, NEW.id, NULL, NULL, NULL
      );
    END IF;
  ELSE
    SELECT author_id INTO v_parent_author_id
    FROM public.post_comments
    WHERE id = NEW.parent_id;

    IF v_parent_author_id IS NOT NULL AND v_parent_author_id <> NEW.author_id THEN
      PERFORM public.create_notification(
        v_parent_author_id, NEW.author_id, 'comment_reply'::public.notification_type,
        NEW.post_id, NEW.id, NULL, NULL, NULL
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_comment_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
  v_post_id UUID;
BEGIN
  SELECT c.author_id, c.post_id INTO v_author_id, v_post_id
  FROM public.post_comments c
  WHERE c.id = NEW.comment_id;

  IF v_author_id IS NOT NULL AND v_author_id <> NEW.user_id THEN
    PERFORM public.create_notification(
      v_author_id, NEW.user_id, 'comment_like'::public.notification_type,
      v_post_id, NEW.comment_id, NULL, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comment_likes_notify ON public.comment_likes;
CREATE TRIGGER comment_likes_notify
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_comment_like();

CREATE OR REPLACE FUNCTION public.trg_notify_comment_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
  v_author_id UUID;
BEGIN
  IF NEW.mentioned_user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT c.post_id, c.author_id INTO v_post_id, v_author_id
  FROM public.post_comments c
  WHERE c.id = NEW.comment_id;

  IF v_author_id IS NOT NULL AND v_author_id <> NEW.mentioned_user_id THEN
    PERFORM public.create_notification(
      NEW.mentioned_user_id, v_author_id, 'comment_mention'::public.notification_type,
      v_post_id, NEW.comment_id, NULL, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comment_mentions_notify ON public.comment_mentions;
CREATE TRIGGER comment_mentions_notify
  AFTER INSERT ON public.comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_comment_mention();

-- -----------------------------------------------------------------------------
-- RLS — comment_likes
-- -----------------------------------------------------------------------------
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Curtidas em comentários visíveis conforme post"
  ON public.comment_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.post_comments c
      WHERE c.id = comment_id AND public.can_view_post(c.post_id)
    )
  );

CREATE POLICY "Usuário curte comentário visível"
  ON public.comment_likes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.post_comments c
      WHERE c.id = comment_id AND public.can_view_post(c.post_id)
    )
  );

CREATE POLICY "Usuário remove curtida em comentário"
  ON public.comment_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RLS — comment_mentions
-- -----------------------------------------------------------------------------
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menções em comentário visíveis conforme post"
  ON public.comment_mentions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.post_comments c
      WHERE c.id = comment_id AND public.can_view_post(c.post_id)
    )
  );

CREATE POLICY "Autor registra menções no próprio comentário"
  ON public.comment_mentions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.post_comments c
      WHERE c.id = comment_id AND c.author_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- RLS — post_comments (respostas no mesmo post)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuário comenta em posts visíveis" ON public.post_comments;

CREATE POLICY "Usuário comenta em posts visíveis"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_view_post(post_id)
    AND (
      parent_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.post_comments pc
        WHERE pc.id = parent_id AND pc.post_id = post_id
      )
    )
  );
