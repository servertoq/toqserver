-- Placar por sets (até 3) em resultados de partida aberta

ALTER TABLE public.open_match_results
  ADD COLUMN IF NOT EXISTS set1_team1 SMALLINT CHECK (set1_team1 IS NULL OR (set1_team1 >= 0 AND set1_team1 <= 99)),
  ADD COLUMN IF NOT EXISTS set1_team2 SMALLINT CHECK (set1_team2 IS NULL OR (set1_team2 >= 0 AND set1_team2 <= 99)),
  ADD COLUMN IF NOT EXISTS set2_team1 SMALLINT CHECK (set2_team1 IS NULL OR (set2_team1 >= 0 AND set2_team1 <= 99)),
  ADD COLUMN IF NOT EXISTS set2_team2 SMALLINT CHECK (set2_team2 IS NULL OR (set2_team2 >= 0 AND set2_team2 <= 99)),
  ADD COLUMN IF NOT EXISTS set3_team1 SMALLINT CHECK (set3_team1 IS NULL OR (set3_team1 >= 0 AND set3_team1 <= 99)),
  ADD COLUMN IF NOT EXISTS set3_team2 SMALLINT CHECK (set3_team2 IS NULL OR (set3_team2 >= 0 AND set3_team2 <= 99));

UPDATE public.open_match_results
SET
  set1_team1 = team1_score,
  set1_team2 = team2_score
WHERE set1_team1 IS NULL AND set1_team2 IS NULL;

DROP FUNCTION IF EXISTS public.complete_open_match(UUID, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.complete_open_match(
  p_match_id UUID,
  p_set1_team1 INTEGER,
  p_set1_team2 INTEGER,
  p_set2_team1 INTEGER,
  p_set2_team2 INTEGER,
  p_set3_team1 INTEGER,
  p_set3_team2 INTEGER,
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
  v_team1_sets SMALLINT := 0;
  v_team2_sets SMALLINT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_share_scope NOT IN ('participants', 'general') THEN
    RAISE EXCEPTION 'Escopo de publicação inválido';
  END IF;

  IF p_set1_team1 IS NULL OR p_set1_team2 IS NULL
     OR p_set1_team1 < 0 OR p_set1_team2 < 0
     OR p_set1_team1 > 99 OR p_set1_team2 > 99 THEN
    RAISE EXCEPTION 'Placar do 1º set inválido';
  END IF;

  IF p_set2_team1 IS NULL OR p_set2_team2 IS NULL
     OR p_set2_team1 < 0 OR p_set2_team2 < 0
     OR p_set2_team1 > 99 OR p_set2_team2 > 99 THEN
    RAISE EXCEPTION 'Placar do 2º set inválido';
  END IF;

  IF p_set3_team1 IS NULL OR p_set3_team2 IS NULL
     OR p_set3_team1 < 0 OR p_set3_team2 < 0
     OR p_set3_team1 > 99 OR p_set3_team2 > 99 THEN
    RAISE EXCEPTION 'Placar do 3º set inválido';
  END IF;

  IF p_set1_team1 > p_set1_team2 THEN v_team1_sets := v_team1_sets + 1;
  ELSIF p_set1_team2 > p_set1_team1 THEN v_team2_sets := v_team2_sets + 1;
  END IF;
  IF p_set2_team1 > p_set2_team2 THEN v_team1_sets := v_team1_sets + 1;
  ELSIF p_set2_team2 > p_set2_team1 THEN v_team2_sets := v_team2_sets + 1;
  END IF;
  IF p_set3_team1 > p_set3_team2 THEN v_team1_sets := v_team1_sets + 1;
  ELSIF p_set3_team2 > p_set3_team1 THEN v_team2_sets := v_team2_sets + 1;
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
    open_match_id, reported_by, format,
    team1_score, team2_score,
    set1_team1, set1_team2, set2_team1, set2_team2, set3_team1, set3_team2,
    share_scope, community_id, location_label, played_at
  ) VALUES (
    p_match_id, v_uid, v_match.format,
    v_team1_sets, v_team2_sets,
    p_set1_team1, p_set1_team2, p_set2_team1, p_set2_team2, p_set3_team1, p_set3_team2,
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
    v_community := v_match.community_id;
  ELSE
    v_vis := 'public'::public.post_visibility;
    v_community := v_match.community_id;
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

REVOKE ALL ON FUNCTION public.complete_open_match(
  UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_open_match(
  UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT
) TO authenticated;

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
    'set1_team1', r.set1_team1,
    'set1_team2', r.set1_team2,
    'set2_team1', r.set2_team1,
    'set2_team2', r.set2_team2,
    'set3_team1', r.set3_team1,
    'set3_team2', r.set3_team2,
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
