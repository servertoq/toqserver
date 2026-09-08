-- Limite de fotos do perfil: 5 (UI + trigger)
CREATE OR REPLACE FUNCTION public.profile_photos_max_six()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.profile_photos
  WHERE user_id = NEW.user_id;

  IF TG_OP = 'INSERT' AND v_count >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 fotos no perfil';
  END IF;

  RETURN NEW;
END;
$$;
