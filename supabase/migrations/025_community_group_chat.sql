-- =============================================================================
-- Toq Tennis — Chat de grupo por comunidade / clube
-- =============================================================================

CREATE TYPE public.dm_conversation_kind AS ENUM ('direct', 'community');

ALTER TABLE public.dm_conversations
  ADD COLUMN kind public.dm_conversation_kind NOT NULL DEFAULT 'direct',
  ADD COLUMN community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;

ALTER TABLE public.dm_conversations
  DROP CONSTRAINT dm_conversations_no_self,
  DROP CONSTRAINT dm_conversations_order;

ALTER TABLE public.dm_conversations
  DROP CONSTRAINT dm_conversations_user_low_user_high_key;

ALTER TABLE public.dm_conversations
  ALTER COLUMN user_low DROP NOT NULL,
  ALTER COLUMN user_high DROP NOT NULL;

ALTER TABLE public.dm_conversations
  ADD CONSTRAINT dm_conversations_direct_shape CHECK (
    kind = 'community'
    OR (
      kind = 'direct'
      AND user_low IS NOT NULL
      AND user_high IS NOT NULL
      AND user_low < user_high
      AND user_low <> user_high
    )
  );

ALTER TABLE public.dm_conversations
  ADD CONSTRAINT dm_conversations_community_shape CHECK (
    kind <> 'community'
    OR (
      community_id IS NOT NULL
      AND user_low IS NULL
      AND user_high IS NULL
    )
  );

ALTER TABLE public.dm_conversations
  ADD CONSTRAINT dm_conversations_direct_kind CHECK (
    kind <> 'direct' OR community_id IS NULL
  );

CREATE UNIQUE INDEX dm_conversations_direct_unique
  ON public.dm_conversations (user_low, user_high)
  WHERE kind = 'direct';

CREATE UNIQUE INDEX dm_conversations_community_unique
  ON public.dm_conversations (community_id)
  WHERE kind = 'community';

CREATE INDEX dm_conversations_community_idx
  ON public.dm_conversations (community_id, last_message_at DESC)
  WHERE kind = 'community';

-- -----------------------------------------------------------------------------
-- Acesso a conversas (direta ou grupo da comunidade)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dm_user_can_access_conversation(
  p_conversation_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dm_conversations c
    WHERE c.id = p_conversation_id
      AND (
        (
          c.kind = 'direct'
          AND p_user_id IS NOT NULL
          AND p_user_id IN (c.user_low, c.user_high)
        )
        OR (
          c.kind = 'community'
          AND public.is_community_member(c.community_id, p_user_id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.dm_user_can_access_conversation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_user_can_access_conversation(UUID, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Criar chat de grupo ao criar comunidade / clube
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_community_dm_conversation(p_community_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_community_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = p_community_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.dm_conversations (kind, community_id)
  VALUES ('community', p_community_id)
  ON CONFLICT (community_id) WHERE (kind = 'community') DO NOTHING;

  SELECT id INTO v_id
  FROM public.dm_conversations
  WHERE kind = 'community' AND community_id = p_community_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_community_dm_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_community_dm_conversation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_ensure_community_dm_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_community_dm_conversation(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communities_ensure_dm_chat ON public.communities;
CREATE TRIGGER communities_ensure_dm_chat
  AFTER INSERT ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_ensure_community_dm_on_create();

-- Comunidades já existentes
INSERT INTO public.dm_conversations (kind, community_id)
SELECT 'community', c.id
FROM public.communities c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dm_conversations d
  WHERE d.kind = 'community' AND d.community_id = c.id
);

CREATE OR REPLACE FUNCTION public.get_or_create_community_dm_conversation(p_community_id UUID)
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

  IF p_community_id IS NULL THEN
    RAISE EXCEPTION 'Comunidade inválida';
  END IF;

  IF NOT public.is_community_member(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Você não faz parte deste grupo';
  END IF;

  v_id := public.ensure_community_dm_conversation(p_community_id);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível abrir o chat do grupo';
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_community_dm_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_community_dm_conversation(UUID) TO authenticated;

-- Atualiza get_or_create direto (índice parcial)
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_low UUID;
  v_high UUID;
  v_id UUID;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Conversa inválida';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  v_low := LEAST(v_me, p_other_user_id);
  v_high := GREATEST(v_me, p_other_user_id);

  INSERT INTO public.dm_conversations (kind, user_low, user_high)
  VALUES ('direct', v_low, v_high)
  ON CONFLICT (user_low, user_high) WHERE (kind = 'direct') DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.dm_conversations
    WHERE kind = 'direct' AND user_low = v_low AND user_high = v_high;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_dm_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.dm_user_can_access_conversation(p_conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  INSERT INTO public.dm_conversation_reads (conversation_id, user_id, last_read_at)
  VALUES (p_conversation_id, auth.uid(), NOW())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participante vê conversa" ON public.dm_conversations;
DROP POLICY IF EXISTS "Participante vê mensagens" ON public.dm_messages;
DROP POLICY IF EXISTS "Participante envia mensagem" ON public.dm_messages;
DROP POLICY IF EXISTS "Participante exclui conversa" ON public.dm_conversations;
DROP POLICY IF EXISTS "Usuário atualiza própria leitura" ON public.dm_conversation_reads;

CREATE POLICY "Participante vê conversa"
  ON public.dm_conversations FOR SELECT TO authenticated
  USING (public.dm_user_can_access_conversation(id, auth.uid()));

CREATE POLICY "Participante vê mensagens"
  ON public.dm_messages FOR SELECT TO authenticated
  USING (public.dm_user_can_access_conversation(conversation_id, auth.uid()));

CREATE POLICY "Participante envia mensagem"
  ON public.dm_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.dm_user_can_access_conversation(conversation_id, auth.uid())
  );

CREATE POLICY "Participante exclui conversa direta"
  ON public.dm_conversations FOR DELETE TO authenticated
  USING (
    kind = 'direct'
    AND auth.uid() IN (user_low, user_high)
  );

CREATE POLICY "Usuário atualiza própria leitura"
  ON public.dm_conversation_reads FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.dm_user_can_access_conversation(conversation_id, auth.uid())
  );
