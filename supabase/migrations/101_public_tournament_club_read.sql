-- Clubs with public tournaments: allow authenticated users to read basic club
-- info (name/slug/cover) so tournament cards show cover outside the club.

DROP POLICY IF EXISTS "Clubes com torneio público: leitura básica" ON public.communities;

CREATE POLICY "Clubes com torneio público: leitura básica"
  ON public.communities FOR SELECT TO authenticated
  USING (
    kind = 'club'
    AND EXISTS (
      SELECT 1
      FROM public.club_tournaments t
      WHERE t.community_id = communities.id
        AND t.is_active = true
        AND t.is_private = false
    )
  );
