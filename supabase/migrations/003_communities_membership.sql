-- =============================================================================
-- Toq Tennis — Comunidades com membros, privacidade e feed exclusivo
-- =============================================================================

CREATE TYPE public.community_member_role AS ENUM ('owner', 'moderator', 'member');
CREATE TYPE public.join_request_status AS ENUM ('pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Estender tabela communities
-- -----------------------------------------------------------------------------
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.communities
  DROP CONSTRAINT IF EXISTS communities_member_count_max;

-- Remove comunidades demo (member_count > 1000 quebraria a constraint abaixo)
DELETE FROM public.communities;

-- Garante contagem válida em comunidades restantes (se houver)
UPDATE public.communities
SET member_count = LEAST(member_count, 1000)
WHERE member_count > 1000;

ALTER TABLE public.communities
  ADD CONSTRAINT communities_member_count_max CHECK (member_count >= 0 AND member_count <= 1000);

-- -----------------------------------------------------------------------------
-- Membros
-- -----------------------------------------------------------------------------
CREATE TABLE public.community_members (
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          public.community_member_role NOT NULL DEFAULT 'member',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

CREATE INDEX community_members_user_id_idx ON public.community_members (user_id);

-- -----------------------------------------------------------------------------
-- Pedidos de entrada (comunidades privadas)
-- -----------------------------------------------------------------------------
CREATE TABLE public.community_join_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        public.join_request_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX community_join_requests_pending_unique
  ON public.community_join_requests (community_id, user_id)
  WHERE status = 'pending';

CREATE INDEX community_join_requests_community_idx
  ON public.community_join_requests (community_id, status);

-- -----------------------------------------------------------------------------
-- Helpers de papel
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.community_member_role_of(
  p_community_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS public.community_member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_community_member(
  p_community_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_moderate_community(
  p_community_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = p_user_id
      AND role IN ('owner', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_owner(
  p_community_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = p_user_id
      AND role = 'owner'
  );
$$;

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
        p.community_id IS NULL
        OR public.is_community_member(p.community_id, auth.uid())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.community_member_role_of(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_member_role_of(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_community_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_member(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.can_moderate_community(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_moderate_community(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_community_owner(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_owner(UUID, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Sincronizar member_count
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_community_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
  v_count INTEGER;
BEGIN
  v_community_id := COALESCE(NEW.community_id, OLD.community_id);

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.community_members
  WHERE community_id = v_community_id;

  IF v_count > 1000 THEN
    RAISE EXCEPTION 'A comunidade atingiu o limite máximo de 1.000 membros';
  END IF;

  UPDATE public.communities
  SET member_count = v_count
  WHERE id = v_community_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER community_members_sync_count
  AFTER INSERT OR DELETE ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_community_member_count();

-- Dono entra automaticamente ao criar comunidade
CREATE OR REPLACE FUNCTION public.add_owner_on_community_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (community_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER communities_add_owner_member
  AFTER INSERT ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_on_community_create();

-- -----------------------------------------------------------------------------
-- RPC: slug único
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_community_slug(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base TEXT;
  v_slug TEXT;
  v_n INTEGER := 0;
BEGIN
  v_base := LOWER(REGEXP_REPLACE(TRIM(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := TRIM(BOTH '-' FROM v_base);
  IF v_base = '' THEN
    v_base := 'comunidade';
  END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.communities WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::TEXT;
  END LOOP;
  RETURN v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_community_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_community_slug(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: entrar / pedir entrada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_public_community(p_community_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_private BOOLEAN;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT is_private, member_count INTO v_private, v_count
  FROM public.communities WHERE id = p_community_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comunidade não encontrada';
  END IF;

  IF v_private THEN
    RAISE EXCEPTION 'Esta comunidade é privada. Solicite entrada.';
  END IF;

  IF v_count >= 1000 THEN
    RAISE EXCEPTION 'Comunidade cheia (máximo 1.000 membros)';
  END IF;

  IF public.is_community_member(p_community_id, auth.uid()) THEN
    RETURN;
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (p_community_id, auth.uid(), 'member');
END;
$$;

CREATE OR REPLACE FUNCTION public.request_community_join(p_community_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_private BOOLEAN;
  v_request_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT is_private INTO v_private
  FROM public.communities WHERE id = p_community_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comunidade não encontrada';
  END IF;

  IF NOT v_private THEN
    PERFORM public.join_public_community(p_community_id);
    RETURN NULL;
  END IF;

  IF public.is_community_member(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Você já é membro desta comunidade';
  END IF;

  INSERT INTO public.community_join_requests (community_id, user_id, status)
  VALUES (p_community_id, auth.uid(), 'pending')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_request_id;

  IF v_request_id IS NULL THEN
    SELECT id INTO v_request_id
    FROM public.community_join_requests
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND status = 'pending'
    LIMIT 1;
  END IF;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_community_join_request(
  p_request_id UUID,
  p_approve BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT community_id, user_id INTO v_community_id, v_user_id
  FROM public.community_join_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;

  IF NOT public.can_moderate_community(v_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para moderar esta comunidade';
  END IF;

  IF p_approve THEN
    SELECT member_count INTO v_count FROM public.communities WHERE id = v_community_id;
    IF v_count >= 1000 THEN
      RAISE EXCEPTION 'Comunidade cheia (máximo 1.000 membros)';
    END IF;

    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (v_community_id, v_user_id, 'member')
    ON CONFLICT (community_id, user_id) DO NOTHING;

    UPDATE public.community_join_requests
    SET status = 'approved', reviewed_at = NOW(), reviewed_by = auth.uid()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.community_join_requests
    SET status = 'rejected', reviewed_at = NOW(), reviewed_by = auth.uid()
    WHERE id = p_request_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_community_member(
  p_community_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role public.community_member_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT role INTO v_target_role
  FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Não é possível remover o dono da comunidade';
  END IF;

  IF p_user_id = auth.uid() THEN
    DELETE FROM public.community_members
    WHERE community_id = p_community_id AND user_id = p_user_id;
    RETURN;
  END IF;

  IF NOT public.can_moderate_community(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_target_role = 'moderator' AND NOT public.is_community_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o dono pode remover moderadores';
  END IF;

  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_community_moderator(
  p_community_id UUID,
  p_user_id UUID,
  p_is_moderator BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_community_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o dono pode definir moderadores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id AND user_id = p_user_id AND role = 'member'
  ) AND p_is_moderator THEN
    RAISE EXCEPTION 'O usuário precisa ser membro da comunidade';
  END IF;

  UPDATE public.community_members
  SET role = CASE WHEN p_is_moderator THEN 'moderator'::public.community_member_role ELSE 'member'::public.community_member_role END
  WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND role IN ('member', 'moderator');
END;
$$;

REVOKE ALL ON FUNCTION public.join_public_community(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_public_community(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.request_community_join(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_community_join(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_community_join_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_community_join_request(UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_community_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_community_member(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.set_community_moderator(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_community_moderator(UUID, UUID, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS — communities (atualizar)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Comunidades visíveis para autenticados" ON public.communities;

CREATE POLICY "Comunidades visíveis para autenticados"
  ON public.communities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuário cria comunidade"
  ON public.communities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Dono atualiza comunidade"
  ON public.communities FOR UPDATE TO authenticated
  USING (public.is_community_owner(id, auth.uid()))
  WITH CHECK (public.is_community_owner(id, auth.uid()));

-- -----------------------------------------------------------------------------
-- RLS — community_members
-- -----------------------------------------------------------------------------
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros visíveis para membros da mesma comunidade"
  ON public.community_members FOR SELECT TO authenticated
  USING (public.is_community_member(community_id, auth.uid()));

CREATE POLICY "Inserção via funções ou dono"
  ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_community_owner(community_id, auth.uid())
  );

CREATE POLICY "Remoção pelo próprio ou moderador"
  ON public.community_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.can_moderate_community(community_id, auth.uid())
  );

CREATE POLICY "Dono atualiza papéis de membros"
  ON public.community_members FOR UPDATE TO authenticated
  USING (public.is_community_owner(community_id, auth.uid()))
  WITH CHECK (public.is_community_owner(community_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- RLS — community_join_requests
-- -----------------------------------------------------------------------------
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedidos visíveis ao solicitante ou moderadores"
  ON public.community_join_requests FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.can_moderate_community(community_id, auth.uid())
  );

CREATE POLICY "Usuário cria pedido de entrada"
  ON public.community_join_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Moderadores atualizam pedidos"
  ON public.community_join_requests FOR UPDATE TO authenticated
  USING (public.can_moderate_community(community_id, auth.uid()))
  WITH CHECK (public.can_moderate_community(community_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- RLS — posts (feed por comunidade)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Posts visíveis para autenticados" ON public.posts;

CREATE POLICY "Posts visíveis conforme comunidade"
  ON public.posts FOR SELECT TO authenticated
  USING (
    community_id IS NULL
    OR public.is_community_member(community_id, auth.uid())
  );

DROP POLICY IF EXISTS "Usuário cria próprio post" ON public.posts;

CREATE POLICY "Usuário cria post no feed global ou em comunidade onde é membro"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      community_id IS NULL
      OR public.is_community_member(community_id, auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- RLS — post_images, likes, comments (herdam visibilidade do post)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Imagens visíveis para autenticados" ON public.post_images;

CREATE POLICY "Imagens visíveis conforme post"
  ON public.post_images FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Curtidas visíveis para autenticados" ON public.post_likes;

CREATE POLICY "Curtidas visíveis conforme post"
  ON public.post_likes FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Usuário curte posts" ON public.post_likes;

CREATE POLICY "Usuário curte posts visíveis"
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_view_post(post_id)
  );

DROP POLICY IF EXISTS "Comentários visíveis para autenticados" ON public.post_comments;

CREATE POLICY "Comentários visíveis conforme post"
  ON public.post_comments FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Usuário comenta em posts" ON public.post_comments;

CREATE POLICY "Usuário comenta em posts visíveis"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_view_post(post_id)
  );

-- -----------------------------------------------------------------------------
-- Storage — capas de comunidade
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-covers',
  'community-covers',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Capas de comunidade — leitura pública"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'community-covers');

CREATE POLICY "Dono envia capa da comunidade"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-covers'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Dono atualiza capa da comunidade"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'community-covers'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'community-covers'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Dono remove capa da comunidade"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-covers'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
