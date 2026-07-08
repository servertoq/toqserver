-- Inclui quem votou em cada opção (quando o viewer pode ver resultados)

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
            END,
            'voters', CASE
              WHEN v_can_see_results THEN COALESCE((
                SELECT json_agg(
                  json_build_object(
                    'id', pr.id,
                    'username', pr.username,
                    'display_name', pr.display_name,
                    'avatar_url', pr.avatar_url
                  )
                  ORDER BY v.created_at ASC
                )
                FROM public.post_poll_votes v
                JOIN public.profiles pr ON pr.id = v.user_id
                WHERE v.option_id = o.id
              ), '[]'::JSON)
              ELSE '[]'::JSON
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

REVOKE ALL ON FUNCTION public.get_post_poll_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_post_poll_state(UUID) TO authenticated;
