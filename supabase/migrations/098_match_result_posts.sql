-- =============================================================================
-- Resultado de partida → posts no feed dos jogadores
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.open_match_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_match_id   UUID NOT NULL UNIQUE REFERENCES public.open_matches(id) ON DELETE CASCADE,
  reported_by     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  format          TEXT NOT NULL CHECK (format IN ('1v1', '2v2', 'club')),
  team1_score     SMALLINT NOT NULL CHECK (team1_score >= 0 AND team1_score <= 99),
  team2_score     SMALLINT NOT NULL CHECK (team2_score >= 0 AND team2_score <= 99),
  share_scope     TEXT NOT NULL CHECK (share_scope IN ('participants', 'general')),
  community_id    UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  location_label  TEXT NOT NULL DEFAULT '',
  played_at       TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.open_match_result_players (
  result_id     UUID NOT NULL REFERENCES public.open_match_results(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team          SMALLINT NOT NULL CHECK (team IN (1, 2)),
  username      TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  skill_label   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (result_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.open_match_result_posts (
  result_id UUID NOT NULL REFERENCES public.open_match_results(id) ON DELETE CASCADE,
  post_id   UUID NOT NULL UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (result_id, user_id)
);

CREATE INDEX IF NOT EXISTS open_match_result_posts_user_idx
  ON public.open_match_result_posts (user_id);

ALTER TABLE public.open_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_match_result_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_match_result_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver resultado se vê o post" ON public.open_match_results;
CREATE POLICY "Ver resultados autenticados"
  ON public.open_match_results FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Ver jogadores do resultado" ON public.open_match_result_players;
CREATE POLICY "Ver jogadores do resultado"
  ON public.open_match_result_players FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Ver vínculo post resultado" ON public.open_match_result_posts;
CREATE POLICY "Ver vínculo post resultado"
  ON public.open_match_result_posts FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

-- Visibilidade: participantes da partida
CREATE OR REPLACE FUNCTION public.can_view_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = p_post_id
      AND (
        p.author_id = auth.uid()
        OR (
          p.community_id IS NOT NULL
          AND public.is_community_member(p.community_id, auth.uid())
        )
        OR (
          p.community_id IS NOT NULL
          AND p.visibility = 'public'::public.post_visibility
        )
        OR (
          p.community_id IS NULL
          AND p.visibility = 'public'::public.post_visibility
        )
        OR (
          p.community_id IS NULL
          AND p.visibility = 'private'::public.post_visibility
          AND public.is_friend_of_author(p.author_id)
        )
        OR (
          p.visibility = 'participants'::public.post_visibility
          AND EXISTS (
            SELECT 1
            FROM public.open_match_result_posts rp
            JOIN public.open_match_result_players rpl
              ON rpl.result_id = rp.result_id
            WHERE rp.post_id = p.id
              AND rpl.user_id = auth.uid()
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.complete_open_match(
  p_match_id UUID,
  p_team1_score INTEGER,
  p_team2_score INTEGER,
  p_share_scope TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_match public.open_matches%ROWTYPE;
  v_result_id UUID;
  v_location TEXT;
  v_vis public.post_visibility;
  v_community UUID;
  r RECORD;
  v_post_id UUID;
  v_skill TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_share_scope NOT IN ('participants', 'general') THEN
    RAISE EXCEPTION 'Escopo de publicação inválido';
  END IF;

  IF p_team1_score IS NULL OR p_team2_score IS NULL
     OR p_team1_score < 0 OR p_team2_score < 0
     OR p_team1_score > 99 OR p_team2_score > 99 THEN
    RAISE EXCEPTION 'Placar inválido';
  END IF;

  SELECT * INTO v_match FROM public.open_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.created_by <> v_uid THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('cancelled', 'done') THEN
    RAISE EXCEPTION 'Partida já encerrada';
  END IF;

  IF EXISTS (SELECT 1 FROM public.open_match_results WHERE open_match_id = p_match_id) THEN
    RAISE EXCEPTION 'Resultado já registrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.open_match_players
    WHERE match_id = p_match_id AND status = 'confirmed' AND user_id <> v_uid
  ) THEN
    -- permite 1 jogador só? melhor exigir pelo menos o criador; placar 1v1 precisa do adversário
    NULL;
  END IF;

  v_skill := to_char(round(v_match.skill_level::numeric, 1), 'FM999990.0');
  v_location := CASE
    WHEN v_match.community_id IS NOT NULL THEN
      coalesce(
        (SELECT name FROM public.communities WHERE id = v_match.community_id),
        v_match.court_name
      )
    ELSE coalesce(nullif(trim(v_match.court_name), ''), v_match.city, 'Partida')
  END;

  INSERT INTO public.open_match_results (
    open_match_id, reported_by, format, team1_score, team2_score,
    share_scope, community_id, location_label, played_at
  ) VALUES (
    p_match_id, v_uid, v_match.format, p_team1_score, p_team2_score,
    p_share_scope, v_match.community_id, left(v_location, 120), v_match.starts_at
  )
  RETURNING id INTO v_result_id;

  INSERT INTO public.open_match_result_players (
    result_id, user_id, team, username, display_name, avatar_url, skill_label
  )
  SELECT
    v_result_id,
    p.user_id,
    p.team,
    u.username,
    u.display_name,
    u.avatar_url,
    v_skill
  FROM public.open_match_players p
  JOIN public.profiles u ON u.id = p.user_id
  WHERE p.match_id = p_match_id AND p.status = 'confirmed';

  IF NOT EXISTS (SELECT 1 FROM public.open_match_result_players WHERE result_id = v_result_id) THEN
    RAISE EXCEPTION 'Nenhum jogador confirmado';
  END IF;

  IF p_share_scope = 'participants' THEN
    v_vis := 'participants'::public.post_visibility;
    v_community := v_match.community_id; -- mantém vínculo p/ opção futura "só clube"
  ELSE
    v_vis := 'public'::public.post_visibility;
    v_community := v_match.community_id; -- clube + feed geral; sem clube = null + public
  END IF;

  FOR r IN
    SELECT user_id FROM public.open_match_result_players WHERE result_id = v_result_id
  LOOP
    INSERT INTO public.posts (
      author_id, body, post_type, title, visibility, community_id, event_date
    ) VALUES (
      r.user_id,
      '',
      'match_result'::public.post_type,
      NULL,
      v_vis,
      v_community,
      (v_match.starts_at AT TIME ZONE 'America/Sao_Paulo')::date
    )
    RETURNING id INTO v_post_id;

    INSERT INTO public.open_match_result_posts (result_id, post_id, user_id)
    VALUES (v_result_id, v_post_id, r.user_id);
  END LOOP;

  UPDATE public.open_matches
  SET status = 'done'
  WHERE id = p_match_id;

  RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_open_match(UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_open_match(UUID, INTEGER, INTEGER, TEXT) TO authenticated;

-- Autor ajusta como o resultado aparece no próprio feed/perfil
CREATE OR REPLACE FUNCTION public.update_match_result_visibility(
  p_post_id UUID,
  p_mode TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_post public.posts%ROWTYPE;
  v_result public.open_match_results%ROWTYPE;
  v_vis public.post_visibility;
  v_community UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_post FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND OR v_post.author_id <> v_uid OR v_post.post_type IS DISTINCT FROM 'match_result'::public.post_type THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT r.* INTO v_result
  FROM public.open_match_results r
  JOIN public.open_match_result_posts rp ON rp.result_id = r.id
  WHERE rp.post_id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resultado não encontrado';
  END IF;

  IF p_mode = 'everyone' THEN
    v_vis := 'public'::public.post_visibility;
    v_community := v_result.community_id; -- se clube, público no clube + geral
  ELSIF p_mode = 'friends' THEN
    v_vis := 'private'::public.post_visibility;
    v_community := NULL;
  ELSIF p_mode = 'club' THEN
    IF v_result.community_id IS NULL THEN
      RAISE EXCEPTION 'Esta partida não está vinculada a um clube';
    END IF;
    v_vis := 'private'::public.post_visibility;
    v_community := v_result.community_id;
  ELSIF p_mode = 'participants' THEN
    v_vis := 'participants'::public.post_visibility;
    v_community := v_result.community_id;
  ELSE
    RAISE EXCEPTION 'Modo de visibilidade inválido';
  END IF;

  UPDATE public.posts
  SET visibility = v_vis,
      community_id = v_community
  WHERE id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_match_result_visibility(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_match_result_visibility(UUID, TEXT) TO authenticated;

-- Helper: dados do resultado por post
CREATE OR REPLACE FUNCTION public.get_match_result_for_post(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out JSONB;
BEGIN
  IF NOT public.can_view_post(p_post_id) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'result_id', r.id,
    'open_match_id', r.open_match_id,
    'format', r.format,
    'team1_score', r.team1_score,
    'team2_score', r.team2_score,
    'share_scope', r.share_scope,
    'community_id', r.community_id,
    'location_label', r.location_label,
    'played_at', r.played_at,
    'players', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', p.user_id,
          'team', p.team,
          'username', p.username,
          'display_name', p.display_name,
          'avatar_url', p.avatar_url,
          'skill_label', p.skill_label
        )
        ORDER BY p.team, p.username
      )
      FROM public.open_match_result_players p
      WHERE p.result_id = r.id
    ), '[]'::jsonb)
  )
  INTO v_out
  FROM public.open_match_result_posts rp
  JOIN public.open_match_results r ON r.id = rp.result_id
  WHERE rp.post_id = p_post_id;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_result_for_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_result_for_post(UUID) TO authenticated;
