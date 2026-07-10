-- Gestão de Quadras: donos e moderadores do clube com o mesmo acesso.

CREATE OR REPLACE FUNCTION public.user_can_access_court_management(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_moderate_platform(p_user_id)
  OR EXISTS (
    SELECT 1 FROM public.courts c WHERE c.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.community_members cm
    WHERE cm.user_id = p_user_id
      AND cm.role IN ('owner', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION public.notify_community_court_managers(
  p_community_id UUID,
  p_actor_id UUID,
  p_booking_id UUID
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (recipient_id, actor_id, type, community_id, club_court_booking_id)
  SELECT cm.user_id, p_actor_id, 'court_booking_request', p_community_id, p_booking_id
  FROM public.community_members cm
  WHERE cm.community_id = p_community_id
    AND cm.role IN ('owner', 'moderator')
    AND cm.user_id IS DISTINCT FROM p_actor_id;
$$;

CREATE OR REPLACE FUNCTION public.request_club_court_booking(
  p_court_id UUID,
  p_plan_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_quantity INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_court public.club_courts%ROWTYPE;
  v_plan public.club_court_plans%ROWTYPE;
  v_end TIME;
  v_id UUID;
  v_total NUMERIC(10, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_court
  FROM public.club_courts
  WHERE id = p_court_id AND is_active = true;

  IF v_court.id IS NULL THEN
    RAISE EXCEPTION 'Quadra não encontrada';
  END IF;

  IF NOT COALESCE(v_court.rental_available, true) THEN
    RAISE EXCEPTION 'Quadra temporariamente indisponível para locação';
  END IF;

  IF NOT public.can_view_club_court(p_court_id, v_uid) THEN
    RAISE EXCEPTION 'Quadra não disponível para você';
  END IF;

  IF public.can_moderate_community(v_court.community_id, v_uid) THEN
    RAISE EXCEPTION 'Use o painel de Gestão de Quadras para agendamentos manuais';
  END IF;

  SELECT * INTO v_plan
  FROM public.club_court_plans
  WHERE id = p_plan_id AND court_id = p_court_id AND is_active = true;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Plano inválido';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  v_end := (p_start_time + make_interval(mins => v_plan.unit_minutes * p_quantity))::TIME;

  IF NOT public.court_slot_within_hours(p_court_id, p_booking_date, p_start_time, v_end) THEN
    RAISE EXCEPTION 'Horário fora do funcionamento da quadra';
  END IF;

  IF public.court_booking_slot_taken(p_court_id, p_booking_date, p_start_time, v_end) THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;

  v_total := v_plan.price * p_quantity;

  INSERT INTO public.club_court_bookings (
    club_court_id, plan_id, requester_id, booking_date, start_time, end_time,
    quantity, total_price, status, is_manual, created_by
  )
  VALUES (
    p_court_id, p_plan_id, v_uid, p_booking_date, p_start_time, v_end,
    p_quantity, v_total, 'pending', false, v_uid
  )
  RETURNING id INTO v_id;

  PERFORM public.notify_community_court_managers(v_court.community_id, v_uid, v_id);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_community_court_managers(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_community_court_managers(UUID, UUID, UUID) TO authenticated;
