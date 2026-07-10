-- Quadra pode ficar indisponível para locação (ex.: manutenção).

ALTER TABLE public.club_courts
  ADD COLUMN IF NOT EXISTS rental_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rental_unavailable_note TEXT;

ALTER TABLE public.club_courts
  DROP CONSTRAINT IF EXISTS club_court_rental_note_len;

ALTER TABLE public.club_courts
  ADD CONSTRAINT club_court_rental_note_len CHECK (
    rental_unavailable_note IS NULL OR char_length(trim(rental_unavailable_note)) <= 200
  );

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
  v_owner UUID;
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

  v_owner := public.community_owner_id(v_court.community_id);

  IF v_owner IS NOT NULL AND v_owner <> v_uid THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, community_id, club_court_booking_id)
    VALUES (v_owner, v_uid, 'court_booking_request', v_court.community_id, v_id);
  END IF;

  RETURN v_id;
END;
$$;
