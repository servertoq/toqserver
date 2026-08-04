-- Posts só com imagem/vídeo (sem texto) e partidas sem descrição
-- A UI já permite body vazio quando há mídia; a constraint antiga bloqueava.

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_body_check;

-- Mantém limite de tamanho (já existe posts_body_max; recria se faltar)
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_body_max;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_body_max CHECK (char_length(body) <= 4000);
