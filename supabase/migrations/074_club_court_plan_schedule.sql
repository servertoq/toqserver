-- Planos de aluguel com escopo por dias da semana e faixa horária
-- Idempotente

ALTER TABLE public.club_court_plans
  ADD COLUMN IF NOT EXISTS applies_weekdays SMALLINT[] NULL,
  ADD COLUMN IF NOT EXISTS applies_start_time TIME NULL,
  ADD COLUMN IF NOT EXISTS applies_end_time TIME NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'club_court_plans_applies_weekdays_valid'
  ) THEN
    ALTER TABLE public.club_court_plans
      ADD CONSTRAINT club_court_plans_applies_weekdays_valid
      CHECK (
        applies_weekdays IS NULL
        OR (
          cardinality(applies_weekdays) > 0
          AND applies_weekdays <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[]
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.club_court_plans.applies_weekdays IS
  'NULL = todos os dias; senão subset 0=dom .. 6=sáb';
COMMENT ON COLUMN public.club_court_plans.applies_start_time IS
  'NULL = sem limite; com applies_end_time define faixa para planos por hora';
COMMENT ON COLUMN public.club_court_plans.applies_end_time IS
  'NULL = sem limite; início do slot deve ser < este horário';

CREATE OR REPLACE FUNCTION public.club_court_plan_applies(
  p_plan public.club_court_plans,
  p_booking_date DATE,
  p_start_time TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_dow SMALLINT;
BEGIN
  IF p_plan.id IS NULL THEN
    RETURN false;
  END IF;

  v_dow := EXTRACT(DOW FROM p_booking_date)::SMALLINT;

  IF p_plan.applies_weekdays IS NOT NULL
     AND NOT (v_dow = ANY (p_plan.applies_weekdays)) THEN
    RETURN false;
  END IF;

  -- Planos de dia / semana / mês: só dias importam
  IF p_plan.unit_minutes >= 1440 THEN
    RETURN true;
  END IF;

  IF p_plan.applies_start_time IS NOT NULL
     AND p_start_time < p_plan.applies_start_time THEN
    RETURN false;
  END IF;

  IF p_plan.applies_end_time IS NOT NULL
     AND p_start_time >= p_plan.applies_end_time THEN
    RETURN false;
  END IF;

  RETURN true;
END;
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

  IF NOT public.club_court_plan_applies(v_plan, p_booking_date, p_start_time) THEN
    RAISE EXCEPTION 'Plano não válido para este dia/horário';
  END IF;

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

CREATE OR REPLACE FUNCTION public.owner_create_manual_court_booking(
  p_court_id UUID,
  p_plan_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_quantity INTEGER,
  p_guest_name TEXT,
  p_guest_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_mark_paid BOOLEAN DEFAULT true
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
  v_total NUMERIC(10, 2);
  v_id UUID;
  v_block_id UUID;
  v_status public.court_booking_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_court FROM public.club_courts WHERE id = p_court_id AND is_active = true;
  IF v_court.id IS NULL THEN RAISE EXCEPTION 'Quadra não encontrada'; END IF;

  IF NOT public.can_moderate_community(v_court.community_id, v_uid) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_plan FROM public.club_court_plans WHERE id = p_plan_id AND court_id = p_court_id;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Plano inválido'; END IF;

  v_end := (p_start_time + make_interval(mins => v_plan.unit_minutes * GREATEST(1, p_quantity)))::TIME;

  IF NOT public.club_court_plan_applies(v_plan, p_booking_date, p_start_time) THEN
    RAISE EXCEPTION 'Plano não válido para este dia/horário';
  END IF;

  IF NOT public.court_slot_within_hours(p_court_id, p_booking_date, p_start_time, v_end) THEN
    RAISE EXCEPTION 'Horário fora do funcionamento';
  END IF;

  IF public.court_booking_slot_taken(p_court_id, p_booking_date, p_start_time, v_end) THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;

  v_total := v_plan.price * GREATEST(1, p_quantity);
  v_status := CASE WHEN p_mark_paid THEN 'confirmed'::public.court_booking_status ELSE 'awaiting_payment'::public.court_booking_status END;

  IF p_mark_paid THEN
    INSERT INTO public.club_court_blocks (court_id, start_ts, end_ts, reason, created_by)
    VALUES (
      p_court_id,
      p_booking_date + p_start_time,
      p_booking_date + v_end,
      COALESCE(NULLIF(trim(p_guest_name), ''), 'Locação manual'),
      v_uid
    )
    RETURNING id INTO v_block_id;
  END IF;

  INSERT INTO public.club_court_bookings (
    club_court_id, plan_id, requester_id, guest_name, guest_phone, booking_date,
    start_time, end_time, quantity, total_price, status, is_manual, notes,
    paid_at, confirmed_at, block_id, created_by
  )
  VALUES (
    p_court_id, p_plan_id, NULL, NULLIF(trim(p_guest_name), ''), NULLIF(trim(p_guest_phone), ''),
    p_booking_date, p_start_time, v_end, GREATEST(1, p_quantity), v_total, v_status, true,
    NULLIF(trim(p_notes), ''),
    CASE WHEN p_mark_paid THEN now() ELSE NULL END,
    CASE WHEN p_mark_paid THEN now() ELSE NULL END,
    v_block_id, v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.club_court_plan_applies(public.club_court_plans, DATE, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_court_plan_applies(public.club_court_plans, DATE, TIME) TO authenticated;

REVOKE ALL ON FUNCTION public.request_club_court_booking(UUID, UUID, DATE, TIME, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_club_court_booking(UUID, UUID, DATE, TIME, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.owner_create_manual_court_booking(UUID, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_create_manual_court_booking(UUID, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
