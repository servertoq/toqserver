-- =============================================================================
-- Toq Tennis — Amizade mútua ao aceitar pedido + correção de amizades existentes
-- =============================================================================

-- Garante o vínculo inverso para pedidos já aceitos (ex.: quem aceitou não via "Amigo")
INSERT INTO public.friendships (user_id, friend_id)
SELECT f.friend_id, f.user_id
FROM public.friendships f
WHERE f.user_id <> f.friend_id
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.are_friends(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE (user_id = p_user_a AND friend_id = p_user_b)
       OR (user_id = p_user_b AND friend_id = p_user_a)
  );
$$;

REVOKE ALL ON FUNCTION public.are_friends(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_friend_of_author(p_author_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.are_friends(auth.uid(), p_author_id);
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

    INSERT INTO public.friendships (user_id, friend_id)
    VALUES (v_addressee, v_requester)
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

CREATE OR REPLACE FUNCTION public.remove_friendship(p_other_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  DELETE FROM public.friendships
  WHERE (user_id = auth.uid() AND friend_id = p_other_user_id)
     OR (user_id = p_other_user_id AND friend_id = auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friendship(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friendship(UUID) TO authenticated;
