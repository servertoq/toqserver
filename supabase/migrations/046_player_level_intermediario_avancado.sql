-- Novos níveis: intermediário e avançado (entre iniciante e profissional)

ALTER TYPE public.player_level_type ADD VALUE IF NOT EXISTS 'intermediario' AFTER 'iniciante';
ALTER TYPE public.player_level_type ADD VALUE IF NOT EXISTS 'avancado' AFTER 'intermediario';

COMMENT ON COLUMN public.profiles.player_level IS
  'Selo público do jogador: iniciante, intermediário, avançado ou profissional.';
