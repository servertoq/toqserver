-- Painel de moderação: cargos staff, banimentos, tickets e ações de plataforma

DO $$ BEGIN
  CREATE TYPE public.staff_role AS ENUM ('ceo', 'cto', 'moderator', 'marketing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.staff_members (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.staff_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_outcome TEXT
    CHECK (resolution_outcome IS NULL OR resolution_outcome IN ('upheld', 'dismissed'));

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS support_ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE SET NULL;

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'staff_report_upheld';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'staff_report_dismissed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'staff_suggestion_ack';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'staff_support_resolved';

-- -----------------------------------------------------------------------------
-- Funções de cargo
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_staff_role(p_user_id UUID DEFAULT auth.uid())
RETURNS public.staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff_members WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = p_user_id AND role IN ('ceo', 'cto')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_moderate_platform(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = p_user_id AND role IN ('ceo', 'cto', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_support_ticket(p_user_id UUID, p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.can_moderate_platform(p_user_id) THEN TRUE
    WHEN public.get_staff_role(p_user_id) = 'marketing' AND p_topic = 'suggestion' THEN TRUE
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.assert_platform_moderator()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_moderate_platform(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão de moderação da plataforma';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_staff_admin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão administrativa';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Notificação staff → usuário
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_notify_user(
  p_recipient_id UUID,
  p_type public.notification_type,
  p_support_ticket_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_type = 'staff_suggestion_ack'::public.notification_type THEN
    IF NOT public.can_read_support_ticket(auth.uid(), 'suggestion') THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
  ELSE
    PERFORM public.assert_platform_moderator();
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = auth.uid() THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (recipient_id, actor_id, type, support_ticket_id)
  VALUES (p_recipient_id, auth.uid(), p_type, p_support_ticket_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Resolução de tickets
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_resolve_report(
  p_ticket_id UUID,
  p_outcome TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_type public.notification_type;
BEGIN
  PERFORM public.assert_platform_moderator();

  IF p_outcome NOT IN ('upheld', 'dismissed') THEN
    RAISE EXCEPTION 'Resultado inválido';
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket não encontrado';
  END IF;
  IF v_ticket.topic <> 'report' THEN
    RAISE EXCEPTION 'Ticket não é uma denúncia';
  END IF;

  UPDATE public.support_tickets
  SET
    status = 'resolved',
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_outcome = p_outcome,
    read_at = COALESCE(read_at, now())
  WHERE id = p_ticket_id;

  v_type := CASE
    WHEN p_outcome = 'upheld' THEN 'staff_report_upheld'::public.notification_type
    ELSE 'staff_report_dismissed'::public.notification_type
  END;

  PERFORM public.staff_notify_user(v_ticket.user_id, v_type, p_ticket_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_acknowledge_suggestion(p_ticket_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
BEGIN
  IF NOT public.can_read_support_ticket(auth.uid(), 'suggestion') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket não encontrado';
  END IF;
  IF v_ticket.topic <> 'suggestion' THEN
    RAISE EXCEPTION 'Ticket não é uma sugestão';
  END IF;

  UPDATE public.support_tickets
  SET
    status = 'resolved',
    read_at = now(),
    resolved_at = now(),
    resolved_by = auth.uid()
  WHERE id = p_ticket_id;

  PERFORM public.staff_notify_user(
    v_ticket.user_id,
    'staff_suggestion_ack'::public.notification_type,
    p_ticket_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_resolve_support(p_ticket_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
BEGIN
  PERFORM public.assert_platform_moderator();

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket não encontrado';
  END IF;
  IF v_ticket.topic <> 'help' THEN
    RAISE EXCEPTION 'Ticket não é suporte';
  END IF;

  UPDATE public.support_tickets
  SET
    status = 'resolved',
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_note = NULLIF(trim(p_note), ''),
    read_at = COALESCE(read_at, now())
  WHERE id = p_ticket_id;

  PERFORM public.staff_notify_user(
    v_ticket.user_id,
    'staff_support_resolved'::public.notification_type,
    p_ticket_id
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Ações de moderação de conteúdo
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_delete_post(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  DELETE FROM public.posts WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_delete_comment(p_comment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  DELETE FROM public.post_comments WHERE id = p_comment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_delete_community(p_community_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  DELETE FROM public.communities WHERE id = p_community_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_delete_court(p_court_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  DELETE FROM public.courts WHERE id = p_court_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_delete_club_court(p_court_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  DELETE FROM public.club_courts WHERE id = p_court_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_delete_tournament(p_tournament_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  DELETE FROM public.club_tournaments WHERE id = p_tournament_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_delete_conversation(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  DELETE FROM public.dm_conversations WHERE id = p_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_ban_user(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode banir a si mesmo';
  END IF;
  IF public.is_staff_admin(p_user_id) THEN
    RAISE EXCEPTION 'Não é possível banir administradores';
  END IF;

  UPDATE public.profiles
  SET
    is_banned = true,
    banned_at = now(),
    banned_reason = NULLIF(trim(p_reason), '')
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_unban_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_platform_moderator();
  UPDATE public.profiles
  SET is_banned = false, banned_at = NULL, banned_reason = NULL
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_grant_role(
  p_user_id UUID,
  p_role public.staff_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_staff_admin();
  INSERT INTO public.staff_members (user_id, role, granted_by)
  VALUES (p_user_id, p_role, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_revoke_role(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_staff_admin();
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode remover seu próprio cargo';
  END IF;
  DELETE FROM public.staff_members WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_staff_role()
RETURNS public.staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_staff_role(auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff vê membros da equipe" ON public.staff_members;
CREATE POLICY "Staff vê membros da equipe"
  ON public.staff_members FOR SELECT TO authenticated
  USING (
    public.get_staff_role(auth.uid()) IS NOT NULL
  );

DROP POLICY IF EXISTS "Admins gerenciam equipe" ON public.staff_members;
CREATE POLICY "Admins gerenciam equipe"
  ON public.staff_members FOR ALL TO authenticated
  USING (public.is_staff_admin(auth.uid()))
  WITH CHECK (public.is_staff_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff lê tickets de suporte" ON public.support_tickets;
CREATE POLICY "Staff lê tickets de suporte"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (public.can_read_support_ticket(auth.uid(), topic));

DROP POLICY IF EXISTS "Staff atualiza tickets" ON public.support_tickets;
CREATE POLICY "Staff atualiza tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.can_read_support_ticket(auth.uid(), topic))
  WITH CHECK (public.can_read_support_ticket(auth.uid(), topic));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.get_my_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_moderate_platform(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_resolve_report(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_acknowledge_suggestion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_resolve_support(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_delete_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_delete_comment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_delete_community(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_delete_court(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_delete_club_court(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_delete_tournament(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_delete_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_ban_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_unban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_grant_role(UUID, public.staff_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_revoke_role(UUID) TO authenticated;
