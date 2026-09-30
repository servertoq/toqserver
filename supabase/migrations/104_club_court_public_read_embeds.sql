-- Quadras públicas: planos, horários e imagens visíveis para quem pode ver a quadra
-- (antes só membros do clube liam os embeds no detalhe)

CREATE POLICY "Imagens de quadra visíveis conforme quadra"
  ON public.club_court_images FOR SELECT TO authenticated
  USING (public.can_view_club_court(court_id, (SELECT auth.uid())));

CREATE POLICY "Planos visíveis conforme quadra"
  ON public.club_court_plans FOR SELECT TO authenticated
  USING (public.can_view_club_court(court_id, (SELECT auth.uid())));

CREATE POLICY "Funcionamento visível conforme quadra"
  ON public.club_court_hours FOR SELECT TO authenticated
  USING (public.can_view_club_court(court_id, (SELECT auth.uid())));
