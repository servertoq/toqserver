-- =============================================================================
-- Toq Tennis — Leitura de mensagens diretas
-- =============================================================================

CREATE TABLE public.dm_conversation_reads (
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX dm_conversation_reads_user_idx ON public.dm_conversation_reads (user_id);

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

  IF NOT EXISTS (
    SELECT 1 FROM public.dm_conversations c
    WHERE c.id = p_conversation_id
      AND auth.uid() IN (c.user_low, c.user_high)
  ) THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  INSERT INTO public.dm_conversation_reads (conversation_id, user_id, last_read_at)
  VALUES (p_conversation_id, auth.uid(), NOW())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_dm_conversation_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_dm_conversation_read(UUID) TO authenticated;

ALTER TABLE public.dm_conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê própria leitura"
  ON public.dm_conversation_reads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza própria leitura"
  ON public.dm_conversation_reads FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.user_low, c.user_high)
    )
  );

CREATE POLICY "Usuário altera própria leitura"
  ON public.dm_conversation_reads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
