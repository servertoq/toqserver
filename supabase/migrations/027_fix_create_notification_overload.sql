-- Corrige: "function create_notification(...) is not unique"
-- A migration 019 adicionou o 9º parâmetro; a versão de 006 (8 params) permaneceu e gerou ambiguidade.

DROP FUNCTION IF EXISTS public.create_notification(
  UUID,
  UUID,
  public.notification_type,
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
);

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id UUID,
  p_actor_id UUID,
  p_type public.notification_type,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_community_id UUID DEFAULT NULL,
  p_friend_request_id UUID DEFAULT NULL,
  p_join_request_id UUID DEFAULT NULL,
  p_community_invite_id UUID DEFAULT NULL
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
    post_id, comment_id, community_id, friend_request_id, join_request_id, community_invite_id
  )
  VALUES (
    p_recipient_id, p_actor_id, p_type,
    p_post_id, p_comment_id, p_community_id, p_friend_request_id, p_join_request_id, p_community_invite_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

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

  IF public.are_friends(auth.uid(), p_addressee_id) THEN
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
      p_addressee_id,
      auth.uid(),
      'friend_request'::public.notification_type,
      NULL,
      NULL,
      NULL,
      v_id,
      NULL,
      NULL
    );
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(
  UUID,
  UUID,
  public.notification_type,
  UUID,
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_notification(
  UUID,
  UUID,
  public.notification_type,
  UUID,
  UUID,
  UUID,
  UUID,
  UUID,
  UUID
) TO authenticated;

REVOKE ALL ON FUNCTION public.send_friend_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;
