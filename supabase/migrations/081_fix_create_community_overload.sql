-- Remove overload ambígua de create_community (sem instagram/whatsapp).
-- Mantém só a assinatura completa; params extras têm DEFAULT NULL.

DROP FUNCTION IF EXISTS public.create_community(
  TEXT, TEXT, TEXT, BOOLEAN, public.community_kind, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
);

-- Garante a versão canônica (com contato de clube)
CREATE OR REPLACE FUNCTION public.create_community(
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT,
  p_is_private BOOLEAN DEFAULT false,
  p_kind public.community_kind DEFAULT 'community',
  p_accent_color TEXT DEFAULT '#437df4',
  p_address_zip TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_neighborhood TEXT DEFAULT NULL,
  p_address_complement TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_state TEXT DEFAULT NULL,
  p_operating_hours JSONB DEFAULT '[]'::jsonb,
  p_instagram_url TEXT DEFAULT NULL,
  p_contact_whatsapp TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_private BOOLEAN := p_is_private;
  v_id UUID;
  v_slug TEXT;
  v_plan public.user_plan;
  v_max INTEGER;
  v_instagram TEXT := NULLIF(TRIM(p_instagram_url), '');
  v_whatsapp TEXT := NULLIF(regexp_replace(COALESCE(p_contact_whatsapp, ''), '\D', '', 'g'), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF TRIM(p_name) = '' OR TRIM(p_slug) = '' THEN
    RAISE EXCEPTION 'Nome e identificador são obrigatórios';
  END IF;

  IF NOT public.user_can_create_community(v_uid, p_kind) THEN
    SELECT plan INTO v_plan FROM public.profiles WHERE id = v_uid;
    IF p_kind = 'club'::public.community_kind THEN
      IF NOT public.is_proprietario_plan(v_plan) THEN
        RAISE EXCEPTION 'Apenas planos Proprietário podem criar clubes.';
      END IF;
      IF v_plan = 'proprietario_plus'::public.user_plan THEN
        RAISE EXCEPTION 'Limite de clubes atingido.';
      END IF;
      RAISE EXCEPTION 'Limite de clubes atingido (máx. 1 no plano Proprietário).';
    END IF;
    v_max := public.max_communities_for_plan(COALESCE(v_plan, 'free'::public.user_plan));
    RAISE EXCEPTION 'Limite de comunidades atingido (máx. % no seu plano).', v_max;
  END IF;

  IF p_kind = 'club'::public.community_kind THEN
    v_private := true;
  ELSE
    v_instagram := NULL;
    v_whatsapp := NULL;
  END IF;

  IF v_whatsapp IS NOT NULL AND char_length(v_whatsapp) < 10 THEN
    RAISE EXCEPTION 'WhatsApp inválido.';
  END IF;

  INSERT INTO public.communities (
    name, slug, description, is_private, kind, created_by, accent_color,
    address_zip, address_street, address_number, address_neighborhood,
    address_complement, address_city, address_state, operating_hours,
    instagram_url, contact_whatsapp
  )
  VALUES (
    TRIM(p_name),
    TRIM(p_slug),
    TRIM(p_description),
    v_private,
    p_kind,
    v_uid,
    COALESCE(NULLIF(TRIM(p_accent_color), ''), '#437df4'),
    NULLIF(TRIM(p_address_zip), ''),
    NULLIF(TRIM(p_address_street), ''),
    NULLIF(TRIM(p_address_number), ''),
    NULLIF(TRIM(p_address_neighborhood), ''),
    NULLIF(TRIM(p_address_complement), ''),
    NULLIF(TRIM(p_address_city), ''),
    NULLIF(UPPER(TRIM(p_address_state)), ''),
    COALESCE(p_operating_hours, '[]'::jsonb),
    v_instagram,
    v_whatsapp
  )
  RETURNING communities.id, communities.slug INTO v_id, v_slug;

  RETURN QUERY SELECT v_id, v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_community(
  TEXT, TEXT, TEXT, BOOLEAN, public.community_kind, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_community(
  TEXT, TEXT, TEXT, BOOLEAN, public.community_kind, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT
) TO authenticated;
