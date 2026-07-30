-- Jogadores na reserva de quadra (até 3) + espelhamento na agenda do perfil

CREATE TABLE IF NOT EXISTS public.club_court_booking_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.club_court_bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, user_id)
);

CREATE INDEX IF NOT EXISTS club_court_booking_players_user_idx
  ON public.club_court_booking_players (user_id);

CREATE INDEX IF NOT EXISTS club_court_booking_players_booking_idx
  ON public.club_court_booking_players (booking_id);

CREATE OR REPLACE FUNCTION public.enforce_club_court_booking_players_max()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.club_court_booking_players
  WHERE booking_id = NEW.booking_id;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Máximo de 3 jogadores por reserva';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS club_court_booking_players_max_trg ON public.club_court_booking_players;
CREATE TRIGGER club_court_booking_players_max_trg
  BEFORE INSERT ON public.club_court_booking_players
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_club_court_booking_players_max();

ALTER TABLE public.user_agenda_events
  ADD COLUMN IF NOT EXISTS club_court_booking_id UUID REFERENCES public.club_court_bookings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_agenda_events_booking_idx
  ON public.user_agenda_events (club_court_booking_id)
  WHERE club_court_booking_id IS NOT NULL;

ALTER TABLE public.club_court_booking_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jogadores da reserva visíveis" ON public.club_court_booking_players;
CREATE POLICY "Jogadores da reserva visíveis"
  ON public.club_court_booking_players FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_court_bookings b
      JOIN public.club_courts c ON c.id = b.club_court_id
      WHERE b.id = booking_id
        AND (
          b.requester_id = auth.uid()
          OR user_id = auth.uid()
          OR public.can_moderate_community(c.community_id, auth.uid())
          OR public.can_view_club_court(c.id, auth.uid())
        )
    )
  );

-- Sincroniza eventos na agenda do perfil (requester + jogadores)
CREATE OR REPLACE FUNCTION public.sync_club_court_booking_agenda(p_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.club_court_bookings%ROWTYPE;
  v_court public.club_courts%ROWTYPE;
  v_club_name TEXT;
  v_requester_username TEXT;
  v_title TEXT;
  v_notes TEXT;
  v_player RECORD;
  v_usernames TEXT;
BEGIN
  SELECT * INTO v_booking FROM public.club_court_bookings WHERE id = p_booking_id;
  IF v_booking.id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.user_agenda_events WHERE club_court_booking_id = p_booking_id;

  IF v_booking.status NOT IN ('pending', 'awaiting_payment', 'confirmed', 'completed') THEN
    RETURN;
  END IF;

  SELECT * INTO v_court FROM public.club_courts WHERE id = v_booking.club_court_id;
  SELECT name INTO v_club_name FROM public.communities WHERE id = v_court.community_id;
  SELECT username INTO v_requester_username FROM public.profiles WHERE id = v_booking.requester_id;

  SELECT string_agg('@' || p.username, ', ' ORDER BY bp.sort_order)
  INTO v_usernames
  FROM public.club_court_booking_players bp
  JOIN public.profiles p ON p.id = bp.user_id
  WHERE bp.booking_id = p_booking_id;

  v_title := trim(both ' · ' FROM concat_ws(' · ', v_court.name, v_club_name));
  IF char_length(v_title) > 80 THEN
    v_title := left(v_title, 77) || '…';
  END IF;

  v_notes := CASE v_booking.status
    WHEN 'pending' THEN 'Reserva pendente de aprovação'
    WHEN 'awaiting_payment' THEN 'Aguardando pagamento'
    WHEN 'confirmed' THEN 'Reserva confirmada'
    WHEN 'completed' THEN 'Partida concluída'
    ELSE 'Reserva de quadra'
  END;

  IF v_requester_username IS NOT NULL THEN
    v_notes := v_notes || E'\nReservado por @' || v_requester_username;
  ELSIF v_booking.guest_name IS NOT NULL THEN
    v_notes := v_notes || E'\nCliente: ' || v_booking.guest_name;
  END IF;

  IF v_usernames IS NOT NULL THEN
    v_notes := v_notes || E'\nJogadores: ' || v_usernames;
  END IF;

  v_notes := left(v_notes, 500);

  IF v_booking.requester_id IS NOT NULL THEN
    INSERT INTO public.user_agenda_events (
      user_id, event_date, event_time, event_type, title, notes, club_court_booking_id
    ) VALUES (
      v_booking.requester_id,
      v_booking.booking_date,
      v_booking.start_time,
      'jogo',
      v_title,
      v_notes,
      p_booking_id
    );
  END IF;

  FOR v_player IN
    SELECT user_id FROM public.club_court_booking_players WHERE booking_id = p_booking_id
  LOOP
    IF v_player.user_id IS DISTINCT FROM v_booking.requester_id THEN
      INSERT INTO public.user_agenda_events (
        user_id, event_date, event_time, event_type, title, notes, club_court_booking_id
      ) VALUES (
        v_player.user_id,
        v_booking.booking_date,
        v_booking.start_time,
        'jogo',
        v_title,
        v_notes,
        p_booking_id
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.club_court_booking_block_label(p_booking_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.club_court_bookings%ROWTYPE;
  v_username TEXT;
  v_players TEXT;
  v_label TEXT;
BEGIN
  SELECT * INTO v_booking FROM public.club_court_bookings WHERE id = p_booking_id;
  IF v_booking.id IS NULL THEN RETURN 'Reserva'; END IF;

  SELECT username INTO v_username FROM public.profiles WHERE id = v_booking.requester_id;

  SELECT string_agg('@' || p.username, ' · ' ORDER BY bp.sort_order)
  INTO v_players
  FROM public.club_court_booking_players bp
  JOIN public.profiles p ON p.id = bp.user_id
  WHERE bp.booking_id = p_booking_id;

  IF v_username IS NOT NULL THEN
    v_label := '@' || v_username;
  ELSIF v_booking.guest_name IS NOT NULL THEN
    v_label := v_booking.guest_name;
  ELSE
    v_label := 'Reserva confirmada';
  END IF;

  IF v_players IS NOT NULL THEN
    v_label := v_label || ' + ' || v_players;
  END IF;

  RETURN left(v_label, 120);
END;
$$;

-- request com jogadores opcionais
DROP FUNCTION IF EXISTS public.request_club_court_booking(UUID, UUID, DATE, TIME, INTEGER);

CREATE OR REPLACE FUNCTION public.request_club_court_booking(
  p_court_id UUID,
  p_plan_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_quantity INTEGER DEFAULT 1,
  p_player_ids UUID[] DEFAULT '{}'
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
  v_player_id UUID;
  v_sort SMALLINT := 0;
  v_ids UUID[];
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

  v_ids := ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p_player_ids, '{}'::UUID[])) AS x
    WHERE x IS NOT NULL AND x <> v_uid
  );

  IF coalesce(array_length(v_ids, 1), 0) > 3 THEN
    RAISE EXCEPTION 'Máximo de 3 jogadores convidados';
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

  IF v_ids IS NOT NULL THEN
    FOREACH v_player_id IN ARRAY v_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_player_id) THEN
        RAISE EXCEPTION 'Jogador inválido';
      END IF;
      INSERT INTO public.club_court_booking_players (booking_id, user_id, sort_order)
      VALUES (v_id, v_player_id, v_sort);
      v_sort := v_sort + 1;
    END LOOP;
  END IF;

  PERFORM public.notify_community_court_managers(v_court.community_id, v_uid, v_id);
  PERFORM public.sync_club_court_booking_agenda(v_id);

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_mark_court_booking_paid(p_booking_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.club_court_bookings%ROWTYPE;
  v_court public.club_courts%ROWTYPE;
  v_block_id UUID;
  v_label TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_booking FROM public.club_court_bookings WHERE id = p_booking_id;
  IF v_booking.id IS NULL THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;

  SELECT * INTO v_court FROM public.club_courts WHERE id = v_booking.club_court_id;
  IF NOT public.can_moderate_community(v_court.community_id, v_uid) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_booking.status NOT IN ('awaiting_payment', 'pending') THEN
    RAISE EXCEPTION 'Reserva não aguarda pagamento';
  END IF;

  IF public.court_booking_slot_taken(
    v_booking.club_court_id, v_booking.booking_date, v_booking.start_time, v_booking.end_time, p_booking_id
  ) THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;

  v_label := public.club_court_booking_block_label(p_booking_id);

  INSERT INTO public.club_court_blocks (court_id, start_ts, end_ts, reason, created_by)
  VALUES (
    v_booking.club_court_id,
    v_booking.booking_date + v_booking.start_time,
    v_booking.booking_date + v_booking.end_time,
    v_label,
    v_uid
  )
  RETURNING id INTO v_block_id;

  UPDATE public.club_court_bookings
  SET
    status = 'confirmed',
    paid_at = now(),
    confirmed_at = now(),
    block_id = v_block_id
  WHERE id = p_booking_id;

  PERFORM public.sync_club_court_booking_agenda(p_booking_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_review_court_booking(p_booking_id UUID, p_approve BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.club_court_bookings%ROWTYPE;
  v_court public.club_courts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_booking FROM public.club_court_bookings WHERE id = p_booking_id;
  IF v_booking.id IS NULL THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;

  SELECT * INTO v_court FROM public.club_courts WHERE id = v_booking.club_court_id;
  IF NOT public.can_moderate_community(v_court.community_id, v_uid) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_booking.status <> 'pending' THEN
    RAISE EXCEPTION 'Reserva não está pendente';
  END IF;

  IF NOT p_approve THEN
    UPDATE public.club_court_bookings
    SET status = 'rejected', cancelled_at = now()
    WHERE id = p_booking_id;
    PERFORM public.sync_club_court_booking_agenda(p_booking_id);
    RETURN;
  END IF;

  IF public.court_booking_slot_taken(
    v_booking.club_court_id, v_booking.booking_date, v_booking.start_time, v_booking.end_time, p_booking_id
  ) THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;

  UPDATE public.club_court_bookings
  SET status = 'awaiting_payment'
  WHERE id = p_booking_id;

  PERFORM public.sync_club_court_booking_agenda(p_booking_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_cancel_court_booking(p_booking_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.club_court_bookings%ROWTYPE;
  v_court public.club_courts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_booking FROM public.club_court_bookings WHERE id = p_booking_id;
  SELECT * INTO v_court FROM public.club_courts WHERE id = v_booking.club_court_id;

  IF NOT public.can_moderate_community(v_court.community_id, v_uid) AND v_booking.requester_id <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_booking.block_id IS NOT NULL THEN
    DELETE FROM public.club_court_blocks WHERE id = v_booking.block_id;
  END IF;

  UPDATE public.club_court_bookings
  SET status = 'cancelled', cancelled_at = now(), block_id = NULL
  WHERE id = p_booking_id;

  PERFORM public.sync_club_court_booking_agenda(p_booking_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_complete_court_booking(p_booking_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.club_court_bookings%ROWTYPE;
  v_court public.club_courts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_booking FROM public.club_court_bookings WHERE id = p_booking_id;
  SELECT * INTO v_court FROM public.club_courts WHERE id = v_booking.club_court_id;

  IF NOT public.can_moderate_community(v_court.community_id, v_uid) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'awaiting_payment') THEN
    RAISE EXCEPTION 'Reserva não pode ser concluída';
  END IF;

  UPDATE public.club_court_bookings
  SET status = 'completed', completed_at = now()
  WHERE id = p_booking_id;

  PERFORM public.sync_club_court_booking_agenda(p_booking_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_club_court_booking(UUID, UUID, DATE, TIME, INTEGER, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_club_court_booking(UUID, UUID, DATE, TIME, INTEGER, UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_club_court_booking_agenda(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_club_court_booking_agenda(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.club_court_booking_block_label(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_court_booking_block_label(UUID) TO authenticated;
