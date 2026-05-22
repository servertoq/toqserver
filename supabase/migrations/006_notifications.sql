-- =============================================================================
-- Toq Tennis — Notificações (curtidas, comentários, amizade, comunidade)
-- =============================================================================

CREATE TYPE public.notification_type AS ENUM (
  'post_like',
  'post_comment',
  'friend_request',
  'community_join',
  'community_join_request'
);

CREATE TYPE public.friend_request_status AS ENUM ('pending', 'accepted', 'rejected');

-- -----------------------------------------------------------------------------
-- Pedidos de amizade (substitui adição direta)
-- -----------------------------------------------------------------------------
CREATE TABLE public.friend_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        public.friend_request_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,
  CONSTRAINT friend_requests_no_self CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX friend_requests_pending_unique
  ON public.friend_requests (requester_id, addressee_id)
  WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- Notificações
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type              public.notification_type NOT NULL,
  post_id           UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id        UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  community_id      UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  friend_request_id UUID REFERENCES public.friend_requests(id) ON DELETE CASCADE,
  join_request_id   UUID REFERENCES public.community_join_requests(id) ON DELETE CASCADE,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_recipient_idx
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX notifications_unread_idx
  ON public.notifications (recipient_id)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- Criar notificação (interno)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id UUID,
  p_actor_id UUID,
  p_type public.notification_type,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_community_id UUID DEFAULT NULL,
  p_friend_request_id UUID DEFAULT NULL,
  p_join_request_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_recipient_id IS NULL OR p_actor_id IS NULL OR p_recipient_id = p_actor_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, actor_id, type,
    post_id, comment_id, community_id, friend_request_id, join_request_id
  )
  VALUES (
    p_recipient_id, p_actor_id, p_type,
    p_post_id, p_comment_id, p_community_id, p_friend_request_id, p_join_request_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Notificar moderadores da comunidade
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_community_moderators(
  p_community_id UUID,
  p_actor_id UUID,
  p_type public.notification_type,
  p_join_request_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mod UUID;
BEGIN
  FOR v_mod IN
    SELECT user_id
    FROM public.community_members
    WHERE community_id = p_community_id
      AND role IN ('owner', 'moderator')
      AND user_id <> p_actor_id
  LOOP
    PERFORM public.create_notification(
      v_mod, p_actor_id, p_type,
      NULL, NULL, p_community_id, NULL, p_join_request_id
    );
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Triggers — curtidas e comentários
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
BEGIN
  SELECT author_id INTO v_author_id FROM public.posts WHERE id = NEW.post_id;
  IF v_author_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_author_id, NEW.user_id, 'post_like'::public.notification_type,
      NEW.post_id, NULL, NULL, NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER post_likes_notify
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_post_like();

CREATE OR REPLACE FUNCTION public.trg_notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
BEGIN
  SELECT author_id INTO v_author_id FROM public.posts WHERE id = NEW.post_id;
  IF v_author_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_author_id, NEW.author_id, 'post_comment'::public.notification_type,
      NEW.post_id, NEW.id, NULL, NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER post_comments_notify
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_post_comment();

-- -----------------------------------------------------------------------------
-- Pedido de amizade
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_addressee_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode adicionar a si mesmo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id = auth.uid() AND friend_id = p_addressee_id
  ) THEN
    RAISE EXCEPTION 'Vocês já são amigos';
  END IF;

  INSERT INTO public.friend_requests (requester_id, addressee_id, status)
  VALUES (auth.uid(), p_addressee_id, 'pending')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.friend_requests
    WHERE requester_id = auth.uid()
      AND addressee_id = p_addressee_id
      AND status = 'pending'
    LIMIT 1;
  ELSE
    PERFORM public.create_notification(
      p_addressee_id, auth.uid(), 'friend_request'::public.notification_type,
      NULL, NULL, NULL, v_id, NULL
    );
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(
  p_request_id UUID,
  p_accept BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID;
  v_addressee UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT requester_id, addressee_id INTO v_requester, v_addressee
  FROM public.friend_requests
  WHERE id = p_request_id AND status = 'pending' AND addressee_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF p_accept THEN
    INSERT INTO public.friendships (user_id, friend_id)
    VALUES (v_requester, v_addressee)
    ON CONFLICT DO NOTHING;

    UPDATE public.friend_requests
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.friend_requests
    SET status = 'rejected', responded_at = NOW()
    WHERE id = p_request_id;
  END IF;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, NOW())
  WHERE friend_request_id = p_request_id AND recipient_id = auth.uid();
END;
$$;

-- -----------------------------------------------------------------------------
-- Notificar ao entrar / pedir entrada na comunidade
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_community_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.notify_community_moderators(
      NEW.community_id, NEW.user_id,
      'community_join_request'::public.notification_type,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_join_requests_notify
  AFTER INSERT ON public.community_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_community_join_request();

CREATE OR REPLACE FUNCTION public.trg_notify_community_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_private BOOLEAN;
BEGIN
  IF NEW.role = 'member' THEN
    SELECT is_private INTO v_private FROM public.communities WHERE id = NEW.community_id;
    IF NOT v_private THEN
      PERFORM public.notify_community_moderators(
        NEW.community_id, NEW.user_id,
        'community_join'::public.notification_type,
        NULL
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_members_notify
  AFTER INSERT ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_community_member();

-- -----------------------------------------------------------------------------
-- RLS — notifications
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Destinatário vê notificações"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Destinatário marca como lida"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- -----------------------------------------------------------------------------
-- RLS — friend_requests
-- -----------------------------------------------------------------------------
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes veem pedidos de amizade"
  ON public.friend_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE POLICY "Usuário envia pedido"
  ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Destinatário responde pedido"
  ON public.friend_requests FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid())
  WITH CHECK (addressee_id = auth.uid());

REVOKE ALL ON FUNCTION public.send_friend_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_friend_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(UUID, BOOLEAN) TO authenticated;
