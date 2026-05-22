-- =============================================================================
-- Toq Tennis — Corrige RLS ao responder comentários (parent_id)
-- A subconsulta na policy de INSERT não enxergava o comentário pai por causa do RLS.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_valid_comment_parent(
  p_parent_id UUID,
  p_post_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_parent_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.post_comments
      WHERE id = p_parent_id AND post_id = p_post_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_valid_comment_parent(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_comment_parent(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Usuário comenta em posts" ON public.post_comments;
DROP POLICY IF EXISTS "Usuário comenta em posts visíveis" ON public.post_comments;

CREATE POLICY "Usuário comenta em posts visíveis"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_view_post(post_id)
    AND public.is_valid_comment_parent(parent_id, post_id)
  );
