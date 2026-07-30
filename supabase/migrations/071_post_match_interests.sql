-- Partidas no feed do clube: vagas + interesses + notificação ao autor

CREATE TABLE IF NOT EXISTS public.post_matches (
  post_id UUID PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  capacity INTEGER NOT NULL CHECK (capacity >= 1 AND capacity <= 64)
);

CREATE TABLE IF NOT EXISTS public.post_match_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_match_interests_unique UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_match_interests_post_id_idx
  ON public.post_match_interests (post_id, created_at);

ALTER TABLE public.post_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_match_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver partida se pode ver post" ON public.post_matches;
CREATE POLICY "Ver partida se pode ver post"
  ON public.post_matches FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Autor cria meta da partida" ON public.post_matches;
CREATE POLICY "Autor cria meta da partida"
  ON public.post_matches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id
        AND p.author_id = auth.uid()
        AND p.post_type = 'partida'::public.post_type
    )
  );

DROP POLICY IF EXISTS "Autor atualiza meta da partida" ON public.post_matches;
CREATE POLICY "Autor atualiza meta da partida"
  ON public.post_matches FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Ver interesses se pode ver post" ON public.post_match_interests;
CREATE POLICY "Ver interesses se pode ver post"
  ON public.post_match_interests FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Membro registra interesse" ON public.post_match_interests;
CREATE POLICY "Membro registra interesse"
  ON public.post_match_interests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_post(post_id)
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.post_type = 'partida'::public.post_type
    )
  );

DROP POLICY IF EXISTS "Usuário remove próprio interesse" ON public.post_match_interests;
CREATE POLICY "Usuário remove próprio interesse"
  ON public.post_match_interests FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_partida_post_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind public.community_kind;
BEGIN
  IF NEW.post_type IS DISTINCT FROM 'partida'::public.post_type THEN
    RETURN NEW;
  END IF;

  NEW.visibility := 'private'::public.post_visibility;

  IF NEW.community_id IS NULL THEN
    RAISE EXCEPTION 'Partida só pode ser publicada em um clube.';
  END IF;

  SELECT kind INTO v_kind FROM public.communities WHERE id = NEW.community_id;
  IF v_kind IS DISTINCT FROM 'club'::public.community_kind THEN
    RAISE EXCEPTION 'Partida só pode ser publicada em um clube.';
  END IF;

  IF NEW.event_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data da partida.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_partida_post_rules ON public.posts;
CREATE TRIGGER trg_enforce_partida_post_rules
  BEFORE INSERT OR UPDATE OF post_type, visibility, community_id, event_date
  ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_partida_post_rules();

CREATE OR REPLACE FUNCTION public.get_match_interest_state(p_post_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_capacity INTEGER;
  v_author UUID;
BEGIN
  IF v_user IS NULL OR NOT public.can_view_post(p_post_id) THEN
    RETURN NULL;
  END IF;

  SELECT p.author_id, m.capacity
    INTO v_author, v_capacity
  FROM public.posts p
  JOIN public.post_matches m ON m.post_id = p.id
  WHERE p.id = p_post_id
    AND p.post_type = 'partida'::public.post_type;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'capacity', v_capacity,
    'interest_count', (
      SELECT COUNT(*)::INT FROM public.post_match_interests i WHERE i.post_id = p_post_id
    ),
    'my_interested', EXISTS (
      SELECT 1 FROM public.post_match_interests i
      WHERE i.post_id = p_post_id AND i.user_id = v_user
    ),
    'is_author', v_author = v_user,
    'interested', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', pr.id,
          'username', pr.username,
          'display_name', pr.display_name,
          'avatar_url', pr.avatar_url
        )
        ORDER BY i.created_at ASC
      )
      FROM public.post_match_interests i
      JOIN public.profiles pr ON pr.id = i.user_id
      WHERE i.post_id = p_post_id
    ), '[]'::JSON)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_match_interest(p_post_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_author UUID;
  v_community UUID;
  v_capacity INTEGER;
  v_count INTEGER;
  v_had BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.can_view_post(p_post_id) THEN
    RAISE EXCEPTION 'Post não encontrado';
  END IF;

  SELECT p.author_id, p.community_id, m.capacity
    INTO v_author, v_community, v_capacity
  FROM public.posts p
  JOIN public.post_matches m ON m.post_id = p.id
  WHERE p.id = p_post_id
    AND p.post_type = 'partida'::public.post_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada';
  END IF;

  IF v_author = v_user THEN
    RAISE EXCEPTION 'O autor da partida não marca interesse.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.post_match_interests
    WHERE post_id = p_post_id AND user_id = v_user
  ) INTO v_had;

  IF v_had THEN
    DELETE FROM public.post_match_interests
    WHERE post_id = p_post_id AND user_id = v_user;
  ELSE
    SELECT COUNT(*)::INT INTO v_count
    FROM public.post_match_interests
    WHERE post_id = p_post_id;

    IF v_count >= v_capacity THEN
      RAISE EXCEPTION 'Vagas da partida já estão preenchidas.';
    END IF;

    INSERT INTO public.post_match_interests (post_id, user_id)
    VALUES (p_post_id, v_user);

    PERFORM public.create_notification(
      v_author,
      v_user,
      'match_interest'::public.notification_type,
      p_post_id,
      NULL,
      v_community,
      NULL,
      NULL,
      NULL
    );
  END IF;

  RETURN public.get_match_interest_state(p_post_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_interest_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_interest_state(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_match_interest(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_match_interest(UUID) TO authenticated;
