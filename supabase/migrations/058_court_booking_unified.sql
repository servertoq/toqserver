-- =============================================================================
-- Quadras unificadas: visibilidade pública/membros, agendamentos, views e feed
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.court_rental_visibility AS ENUM ('members_only', 'public');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.court_booking_status AS ENUM (
    'pending',
    'awaiting_payment',
    'confirmed',
    'completed',
    'cancelled',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'court';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'court_booking_request';

ALTER TABLE public.club_courts
  ADD COLUMN IF NOT EXISTS rental_visibility public.court_rental_visibility NOT NULL DEFAULT 'members_only',
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS club_courts_visibility_idx
  ON public.club_courts (rental_visibility, is_active);

CREATE TABLE IF NOT EXISTS public.club_court_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_court_id   UUID NOT NULL REFERENCES public.club_courts(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES public.club_court_plans(id) ON DELETE SET NULL,
  requester_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name      TEXT,
  guest_phone     TEXT,
  booking_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price     NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  status          public.court_booking_status NOT NULL DEFAULT 'pending',
  is_manual       BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  paid_at         TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  block_id        UUID REFERENCES public.club_court_blocks(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT club_court_bookings_time_valid CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS club_court_bookings_court_idx
  ON public.club_court_bookings (club_court_id, booking_date, status);

CREATE INDEX IF NOT EXISTS club_court_bookings_requester_idx
  ON public.club_court_bookings (requester_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.club_court_listing_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_court_id UUID NOT NULL REFERENCES public.club_courts(id) ON DELETE CASCADE,
  viewer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_court_listing_views_court_idx
  ON public.club_court_listing_views (club_court_id, viewed_at DESC);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS club_court_booking_id UUID REFERENCES public.club_court_bookings(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_club_court_bookings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS club_court_bookings_updated_at ON public.club_court_bookings;
CREATE TRIGGER club_court_bookings_updated_at
  BEFORE UPDATE ON public.club_court_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_club_court_bookings_updated_at();

CREATE OR REPLACE FUNCTION public.user_can_access_court_management(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courts c WHERE c.owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.club_courts cc
    WHERE public.can_moderate_community(cc.community_id, p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_club_court(p_court_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_courts c
    WHERE c.id = p_court_id
      AND c.is_active = true
      AND (
        c.rental_visibility = 'public'::public.court_rental_visibility
        OR public.is_community_member(c.community_id, p_user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.community_owner_id(p_community_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT cm.user_id
     FROM public.community_members cm
     WHERE cm.community_id = p_community_id AND cm.role = 'owner'
     LIMIT 1),
    (SELECT c.created_by FROM public.communities c WHERE c.id = p_community_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.court_booking_slot_taken(
  p_court_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_court_blocks b
    WHERE b.court_id = p_court_id
      AND b.start_ts < (p_date + p_end)
      AND b.end_ts > (p_date + p_start)
  ) OR EXISTS (
    SELECT 1
    FROM public.club_court_bookings bk
    WHERE bk.club_court_id = p_court_id
      AND bk.booking_date = p_date
      AND bk.status IN ('awaiting_payment', 'confirmed', 'completed')
      AND (p_exclude_booking_id IS NULL OR bk.id <> p_exclude_booking_id)
      AND bk.start_time < p_end
      AND bk.end_time > p_start
  );
$$;

CREATE OR REPLACE FUNCTION public.court_slot_within_hours(
  p_court_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_court_hours h
    WHERE h.court_id = p_court_id
      AND h.weekday = EXTRACT(DOW FROM p_date)::INTEGER
      AND h.start_time <= p_start
      AND h.end_time >= p_end
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS: club_courts visibility
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Quadras do clube visíveis para membros" ON public.club_courts;
CREATE POLICY "Quadras do clube visíveis conforme visibilidade"
  ON public.club_courts FOR SELECT TO authenticated
  USING (
    public.is_community_member(community_id, (SELECT auth.uid()))
    OR rental_visibility = 'public'::public.court_rental_visibility
  );

-- -----------------------------------------------------------------------------
-- RLS: bookings
-- -----------------------------------------------------------------------------

ALTER TABLE public.club_court_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solicitante vê próprias reservas"
  ON public.club_court_bookings FOR SELECT TO authenticated
  USING (requester_id = (SELECT auth.uid()));

CREATE POLICY "Moderadores veem reservas das quadras do clube"
  ON public.club_court_bookings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_courts c
      WHERE c.id = club_court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Solicitante cria reserva"
  ON public.club_court_bookings FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = (SELECT auth.uid())
    AND is_manual = false
    AND status = 'pending'::public.court_booking_status
    AND public.can_view_club_court(club_court_id, (SELECT auth.uid()))
  );

CREATE POLICY "Moderadores atualizam reservas"
  ON public.club_court_bookings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_courts c
      WHERE c.id = club_court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.club_courts c
      WHERE c.id = club_court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Moderadores removem reservas"
  ON public.club_court_bookings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_courts c
      WHERE c.id = club_court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- RLS: listing views
-- -----------------------------------------------------------------------------

ALTER TABLE public.club_court_listing_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário registra view em quadra visível"
  ON public.club_court_listing_views FOR INSERT TO authenticated
  WITH CHECK (
    viewer_id = (SELECT auth.uid())
    AND public.can_view_club_court(club_court_id, (SELECT auth.uid()))
  );

CREATE POLICY "Moderadores leem views das próprias quadras"
  ON public.club_court_listing_views FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_courts c
      WHERE c.id = club_court_id
        AND public.can_moderate_community(c.community_id, (SELECT auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- RPC: registrar clique no anúncio
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_club_court_listing_view(p_court_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.can_view_club_court(p_court_id, v_uid) THEN
    RAISE EXCEPTION 'Quadra não disponível';
  END IF;

  INSERT INTO public.club_court_listing_views (club_court_id, viewer_id)
  VALUES (p_court_id, v_uid);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: solicitar agendamento
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- RPC: gestão pelo proprietário
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owner_review_court_booking(
  p_booking_id UUID,
  p_approve BOOLEAN
)
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

  v_label := COALESCE(v_booking.guest_name, 'Reserva confirmada');

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

-- -----------------------------------------------------------------------------
-- RPC: dashboard
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.court_management_stats(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_from TIMESTAMPTZ;
  v_to TIMESTAMPTZ;
  v_views BIGINT;
  v_bookings BIGINT;
  v_revenue NUMERIC(10, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_from := COALESCE(p_from, date_trunc('month', now())::DATE)::TIMESTAMPTZ;
  v_to := (COALESCE(p_to, CURRENT_DATE) + 1)::TIMESTAMPTZ;

  SELECT COUNT(*)::BIGINT INTO v_views
  FROM public.club_court_listing_views v
  JOIN public.club_courts c ON c.id = v.club_court_id
  WHERE v.viewed_at >= v_from AND v.viewed_at < v_to
    AND public.can_moderate_community(c.community_id, v_uid);

  SELECT COUNT(*)::BIGINT INTO v_bookings
  FROM public.club_court_bookings b
  JOIN public.club_courts c ON c.id = b.club_court_id
  WHERE b.created_at >= v_from AND b.created_at < v_to
    AND b.status IN ('confirmed', 'completed', 'awaiting_payment')
    AND public.can_moderate_community(c.community_id, v_uid);

  SELECT COALESCE(SUM(b.total_price), 0) INTO v_revenue
  FROM public.club_court_bookings b
  JOIN public.club_courts c ON c.id = b.club_court_id
  WHERE b.paid_at IS NOT NULL
    AND b.paid_at >= v_from AND b.paid_at < v_to
    AND b.status IN ('confirmed', 'completed')
    AND public.can_moderate_community(c.community_id, v_uid);

  RETURN jsonb_build_object(
    'listing_views', v_views,
    'bookings_count', v_bookings,
    'total_revenue', v_revenue
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_can_access_court_management(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_court_management(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_club_court_listing_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_club_court_listing_view(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.request_club_court_booking(UUID, UUID, DATE, TIME, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_club_court_booking(UUID, UUID, DATE, TIME, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.owner_review_court_booking(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_review_court_booking(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.owner_mark_court_booking_paid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_mark_court_booking_paid(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.owner_complete_court_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_complete_court_booking(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.owner_cancel_court_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_cancel_court_booking(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.owner_create_manual_court_booking(UUID, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_create_manual_court_booking(UUID, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.court_management_stats(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.court_management_stats(DATE, DATE) TO authenticated;
