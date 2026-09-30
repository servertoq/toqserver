-- Privacidade: detalhes do perfil (partidas, amigos, posts, clubes, meu jogo) só para amigos

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_details_friends_only BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.profile_details_friends_only IS
  'Se true, visitantes que não são amigos veem apenas o básico do perfil.';

CREATE OR REPLACE FUNCTION public.profile_details_visible_to_viewer(
  p_profile_id UUID,
  p_viewer_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_viewer_id IS NULL THEN false
    WHEN p_profile_id = p_viewer_id THEN true
    WHEN NOT COALESCE(
      (SELECT profile_details_friends_only FROM public.profiles WHERE id = p_profile_id),
      false
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.friendships fr
      WHERE (fr.user_id = p_viewer_id AND fr.friend_id = p_profile_id)
         OR (fr.user_id = p_profile_id AND fr.friend_id = p_viewer_id)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.profile_details_visible_to_viewer(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_details_visible_to_viewer(UUID, UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.get_profile_by_username(TEXT);

CREATE FUNCTION public.get_profile_by_username(p_username TEXT)
RETURNS TABLE(
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  birth_date DATE,
  gender public.gender_type,
  player_level public.player_level_type,
  plan public.user_plan,
  created_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  address_zip TEXT,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_complement TEXT,
  address_city TEXT,
  address_state TEXT,
  dominant_hand TEXT,
  experience_band TEXT,
  play_frequency TEXT,
  play_style TEXT,
  favorite_court TEXT,
  profile_details_friends_only BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.birth_date,
    p.gender,
    p.player_level,
    p.plan,
    p.created_at,
    p.last_seen_at,
    p.address_zip,
    p.address_street,
    p.address_number,
    p.address_neighborhood,
    p.address_complement,
    p.address_city,
    p.address_state,
    p.dominant_hand,
    p.experience_band,
    p.play_frequency,
    p.play_style,
    p.favorite_court,
    p.profile_details_friends_only
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(TRIM(p_username))
    AND p.deletion_requested_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_friends_preview(
  p_profile_id UUID,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE(
  friend_id UUID,
  username TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.friend_id,
    pr.username,
    pr.avatar_url
  FROM public.friendships f
  JOIN public.profiles pr ON pr.id = f.friend_id
  JOIN public.profiles owner ON owner.id = f.user_id
  WHERE f.user_id = p_profile_id
    AND owner.deletion_requested_at IS NULL
    AND pr.deletion_requested_at IS NULL
    AND public.profile_details_visible_to_viewer(p_profile_id, auth.uid())
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50));
$$;

CREATE OR REPLACE FUNCTION public.get_profile_clubs(p_profile_id UUID)
RETURNS TABLE(
  community_id UUID,
  name TEXT,
  slug TEXT,
  cover_image_url TEXT,
  kind public.community_kind,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.slug,
    c.cover_image_url,
    c.kind,
    cm.joined_at
  FROM public.community_members cm
  JOIN public.communities c ON c.id = cm.community_id
  JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.user_id = p_profile_id
    AND p.deletion_requested_at IS NULL
    AND public.profile_details_visible_to_viewer(p_profile_id, auth.uid())
  ORDER BY cm.joined_at DESC NULLS LAST, c.name;
$$;
