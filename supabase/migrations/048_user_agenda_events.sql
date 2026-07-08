-- Agenda pessoal do jogador

CREATE TABLE public.user_agenda_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TIME NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('treino', 'aula', 'jogo', 'outro')),
  title TEXT NULL CHECK (title IS NULL OR char_length(trim(title)) BETWEEN 1 AND 80),
  notes TEXT NULL CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_agenda_events_user_date_idx
  ON public.user_agenda_events (user_id, event_date);

COMMENT ON TABLE public.user_agenda_events IS
  'Compromissos pessoais do jogador (treino, aula, jogo, outro).';

ALTER TABLE public.user_agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono lê própria agenda"
  ON public.user_agenda_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Dono cria eventos"
  ON public.user_agenda_events FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Dono atualiza eventos"
  ON public.user_agenda_events FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Dono remove eventos"
  ON public.user_agenda_events FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.set_user_agenda_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_agenda_events_updated_at
  BEFORE UPDATE ON public.user_agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_agenda_events_updated_at();
