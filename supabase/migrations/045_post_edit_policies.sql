-- Permite autor sincronizar menções e ajustar configurações da enquete ao editar

CREATE POLICY "Autor remove menções do próprio post"
  ON public.post_mentions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  );

CREATE POLICY "Autor atualiza enquete"
  ON public.post_polls FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  );
