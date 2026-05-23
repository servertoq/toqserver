-- =============================================================================
-- Toq Tennis — Clubes (grupos privados) + convites para comunidades e clubes
-- =============================================================================

CREATE TYPE public.community_kind AS ENUM ('community', 'club');
CREATE TYPE public.community_invite_status AS ENUM ('pending', 'accepted', 'rejected');

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS kind public.community_kind NOT NULL DEFAULT 'community';

ALTER TABLE public.communities
  ADD CONSTRAINT communities_clubs_always_private
  CHECK (kind <> 'club' OR is_private = true);

-- -----------------------------------------------------------------------------
-- Convites (adição manual por admin/moderador)
-- -----------------------------------------------------------------------------
CREATE TABLE public.community_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  inviter_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        public.community_invite_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,
  CONSTRAINT community_invites_no_self CHECK (inviter_id <> invitee_id)
);

CREATE UNIQUE INDEX community_invites_pending_unique
  ON public.community_invites (community_id, invitee_id)
  WHERE status = 'pending';

CREATE INDEX community_invites_invitee_idx
  ON public.community_invites (invitee_id, status);

-- -----------------------------------------------------------------------------
-- Notificações — convite
-- -----------------------------------------------------------------------------
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'community_invite';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS community_invite_id UUID
  REFERENCES public.community_invites(id) ON DELETE CASCADE;

-- Recriar create_notification com community_invite_id
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

-- -----------------------------------------------------------------------------
-- RPC: convidar membro (comunidade ou clube)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_community_member(
  p_community_id UUID,
  p_invitee_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id UUID;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_invitee_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode convidar a si mesmo';
  END IF;

  IF NOT public.can_moderate_community(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para convidar membros';
  END IF;

  IF public.is_community_member(p_community_id, p_invitee_id) THEN
    RAISE EXCEPTION 'Este usuário já é membro';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_join_requests
    WHERE community_id = p_community_id
      AND user_id = p_invitee_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Este usuário já tem um pedido de entrada pendente';
  END IF;

  SELECT member_count INTO v_count FROM public.communities WHERE id = p_community_id;
  IF v_count >= 1000 THEN
    RAISE EXCEPTION 'Grupo cheio (máximo 1.000 membros)';
  END IF;

  INSERT INTO public.community_invites (community_id, inviter_id, invitee_id, status)
  VALUES (p_community_id, auth.uid(), p_invitee_id, 'pending')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_invite_id;

  IF v_invite_id IS NULL THEN
    SELECT id INTO v_invite_id
    FROM public.community_invites
    WHERE community_id = p_community_id
      AND invitee_id = p_invitee_id
      AND status = 'pending'
    LIMIT 1;
  ELSE
    PERFORM public.create_notification(
      p_invitee_id, auth.uid(), 'community_invite'::public.notification_type,
      NULL, NULL, p_community_id, NULL, NULL, v_invite_id
    );
  END IF;

  RETURN v_invite_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_community_member_by_username(
  p_community_id UUID,
  p_username TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitee_id UUID;
  v_trimmed TEXT;
BEGIN
  v_trimmed := LOWER(TRIM(REPLACE(p_username, '@', '')));
  IF LENGTH(v_trimmed) < 3 THEN
    RAISE EXCEPTION 'Informe um nome de usuário válido';
  END IF;

  SELECT id INTO v_invitee_id
  FROM public.profiles
  WHERE LOWER(username) = v_trimmed
  LIMIT 1;

  IF v_invitee_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  RETURN public.invite_community_member(p_community_id, v_invitee_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: responder convite
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_community_invite(
  p_invite_id UUID,
  p_accept BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT community_id INTO v_community_id
  FROM public.community_invites
  WHERE id = p_invite_id
    AND invitee_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado ou já respondido';
  END IF;

  IF p_accept THEN
    SELECT member_count INTO v_count FROM public.communities WHERE id = v_community_id;
    IF v_count >= 1000 THEN
      RAISE EXCEPTION 'Grupo cheio (máximo 1.000 membros)';
    END IF;

    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (v_community_id, auth.uid(), 'member')
    ON CONFLICT (community_id, user_id) DO NOTHING;

    UPDATE public.community_invites
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_invite_id;

    UPDATE public.community_join_requests
    SET status = 'approved', reviewed_at = NOW(), reviewed_by = auth.uid()
    WHERE community_id = v_community_id
      AND user_id = auth.uid()
      AND status = 'pending';
  ELSE
    UPDATE public.community_invites
    SET status = 'rejected', responded_at = NOW()
    WHERE id = p_invite_id;
  END IF;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, NOW())
  WHERE community_invite_id = p_invite_id AND recipient_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.invite_community_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_community_member(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.invite_community_member_by_username(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_community_member_by_username(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_community_invite(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_community_invite(UUID, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS — communities: clubes só visíveis para membros / pedido / convite
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Comunidades visíveis para autenticados" ON public.communities;

CREATE POLICY "Comunidades e clubes visíveis conforme tipo"
  ON public.communities FOR SELECT TO authenticated
  USING (
    kind = 'community'
    OR public.is_community_member(id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.community_join_requests
      WHERE community_id = id
        AND user_id = auth.uid()
        AND status = 'pending'
    )
    OR EXISTS (
      SELECT 1 FROM public.community_invites
      WHERE community_id = id
        AND invitee_id = auth.uid()
        AND status = 'pending'
    )
  );

-- Criação: comunidade ou clube
DROP POLICY IF EXISTS "Usuário cria comunidade" ON public.communities;

CREATE POLICY "Usuário cria comunidade ou clube"
  ON public.communities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- -----------------------------------------------------------------------------
-- RLS — community_members: sem adição direta pelo dono
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Inserção via funções ou dono" ON public.community_members;

CREATE POLICY "Membro entra apenas como próprio usuário"
  ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RLS — community_invites
-- -----------------------------------------------------------------------------
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Convites visíveis ao convidado ou moderadores"
  ON public.community_invites FOR SELECT TO authenticated
  USING (
    invitee_id = auth.uid()
    OR public.can_moderate_community(community_id, auth.uid())
  );

CREATE POLICY "Convites criados via RPC"
  ON public.community_invites FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Convidado responde convite"
  ON public.community_invites FOR UPDATE TO authenticated
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid());
