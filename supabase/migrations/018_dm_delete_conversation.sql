-- Permite excluir conversa (participante remove para ambos — CASCADE apaga mensagens)

CREATE POLICY "Participante exclui conversa"
  ON public.dm_conversations FOR DELETE TO authenticated
  USING (auth.uid() IN (user_low, user_high));
