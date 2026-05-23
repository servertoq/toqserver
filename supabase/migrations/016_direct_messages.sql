-- =============================================================================
-- Toq Tennis — Mensagens diretas (amigos + pendentes)
-- =============================================================================

CREATE TABLE public.dm_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_high       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_conversations_no_self CHECK (user_low <> user_high),
  CONSTRAINT dm_conversations_order CHECK (user_low < user_high),
  UNIQUE (user_low, user_high)
);

CREATE INDEX dm_conversations_user_low_idx ON public.dm_conversations (user_low, last_message_at DESC);
CREATE INDEX dm_conversations_user_high_idx ON public.dm_conversations (user_high, last_message_at DESC);

CREATE TABLE public.dm_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body             TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 4000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX dm_messages_conversation_idx ON public.dm_messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dm_other_user(
  p_user_low UUID,
  p_user_high UUID,
  p_viewer UUID
)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_viewer = p_user_low THEN p_user_high
    WHEN p_viewer = p_user_high THEN p_user_low
    ELSE NULL
  END;
$$;

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

  INSERT INTO public.dm_conversations (user_low, user_high)
  VALUES (v_low, v_high)
  ON CONFLICT (user_low, user_high) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.dm_conversations
    WHERE user_low = v_low AND user_high = v_high;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_dm_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_dm_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.dm_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dm_messages_touch_conversation
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_dm_conversation();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participante vê conversa"
  ON public.dm_conversations FOR SELECT TO authenticated
  USING (auth.uid() IN (user_low, user_high));

CREATE POLICY "Participante vê mensagens"
  ON public.dm_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.user_low, c.user_high)
    )
  );

CREATE POLICY "Participante envia mensagem"
  ON public.dm_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.user_low, c.user_high)
    )
  );
