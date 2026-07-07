-- Passo 2: tabelas, RLS e funções de enquete (após 043_post_polls_enum)

CREATE TABLE public.post_polls (
  post_id UUID PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  show_results_to_all BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.post_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 120),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX post_poll_options_post_id_idx ON public.post_poll_options (post_id);

CREATE TABLE public.post_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.post_poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (option_id, user_id)
);

CREATE INDEX post_poll_votes_post_user_idx ON public.post_poll_votes (post_id, user_id);

ALTER TABLE public.post_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enquete visível com o post"
  ON public.post_polls FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

CREATE POLICY "Autor cria enquete"
  ON public.post_polls FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id
        AND p.author_id = (SELECT auth.uid())
        AND p.post_type = 'poll'::public.post_type
    )
  );

CREATE POLICY "Opções visíveis com o post"
  ON public.post_poll_options FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

CREATE POLICY "Autor cria opções"
  ON public.post_poll_options FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id
        AND p.author_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Votos visíveis para autor ou se liberado"
  ON public.post_poll_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.post_polls pp ON pp.post_id = p.id
      WHERE p.id = post_poll_votes.post_id
        AND public.can_view_post(p.id)
        AND (pp.show_results_to_all OR p.author_id = (SELECT auth.uid()))
    )
    OR user_id = (SELECT auth.uid())
  );

CREATE POLICY "Usuário vota em enquete visível"
  ON public.post_poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.can_view_post(post_id)
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.post_type = 'poll'::public.post_type
    )
    AND EXISTS (
      SELECT 1 FROM public.post_poll_options o
      WHERE o.id = option_id AND o.post_id = post_poll_votes.post_id
    )
  );

CREATE POLICY "Usuário remove próprio voto"
  ON public.post_poll_votes FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.vote_on_poll(p_post_id UUID, p_option_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_poll public.post_polls%ROWTYPE;
  v_opt UUID;
  v_count INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.can_view_post(p_post_id) THEN
    RAISE EXCEPTION 'Sem permissão para votar nesta enquete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = p_post_id AND post_type = 'poll'::public.post_type
  ) THEN
    RAISE EXCEPTION 'Publicação não é uma enquete';
  END IF;

  SELECT * INTO v_poll FROM public.post_polls WHERE post_id = p_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquete não encontrada';
  END IF;

  v_count := COALESCE(array_length(p_option_ids, 1), 0);
  IF v_count < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos uma opção';
  END IF;

  IF NOT v_poll.allow_multiple AND v_count > 1 THEN
    RAISE EXCEPTION 'Esta enquete permite apenas uma resposta';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_option_ids) AS oid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.post_poll_options
      WHERE id = oid AND post_id = p_post_id
    )
  ) THEN
    RAISE EXCEPTION 'Opção inválida';
  END IF;

  DELETE FROM public.post_poll_votes
  WHERE post_id = p_post_id AND user_id = v_user;

  FOREACH v_opt IN ARRAY p_option_ids LOOP
    INSERT INTO public.post_poll_votes (post_id, option_id, user_id)
    VALUES (p_post_id, v_opt, v_user);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_post_poll_state(p_post_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_author UUID;
  v_poll public.post_polls%ROWTYPE;
  v_can_see_results BOOLEAN;
BEGIN
  IF v_user IS NULL OR NOT public.can_view_post(p_post_id) THEN
    RETURN NULL;
  END IF;

  SELECT author_id INTO v_author FROM public.posts WHERE id = p_post_id;
  SELECT * INTO v_poll FROM public.post_polls WHERE post_id = p_post_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_can_see_results := v_poll.show_results_to_all OR v_author = v_user;

  RETURN (
    SELECT json_build_object(
      'allow_multiple', v_poll.allow_multiple,
      'show_results_to_all', v_poll.show_results_to_all,
      'can_see_results', v_can_see_results,
      'options', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', o.id,
            'label', o.label,
            'sort_order', o.sort_order,
            'vote_count', CASE
              WHEN v_can_see_results THEN (
                SELECT COUNT(*)::INT FROM public.post_poll_votes v WHERE v.option_id = o.id
              )
              ELSE NULL
            END
          )
          ORDER BY o.sort_order, o.id
        )
        FROM public.post_poll_options o
        WHERE o.post_id = p_post_id
      ), '[]'::JSON),
      'my_option_ids', COALESCE((
        SELECT json_agg(v.option_id)
        FROM public.post_poll_votes v
        WHERE v.post_id = p_post_id AND v.user_id = v_user
      ), '[]'::JSON),
      'total_voters', CASE
        WHEN v_can_see_results THEN (
          SELECT COUNT(DISTINCT user_id)::INT
          FROM public.post_poll_votes
          WHERE post_id = p_post_id
        )
        ELSE NULL
      END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vote_on_poll(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_on_poll(UUID, UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION public.get_post_poll_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_post_poll_state(UUID) TO authenticated;
