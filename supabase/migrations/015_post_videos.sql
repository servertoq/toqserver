-- Vídeos em posts (bucket post-images também armazena vídeos)

ALTER TABLE public.post_images
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image';

ALTER TABLE public.post_images
  DROP CONSTRAINT IF EXISTS post_images_media_type_check;

ALTER TABLE public.post_images
  ADD CONSTRAINT post_images_media_type_check
  CHECK (media_type IN ('image', 'video'));

UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
WHERE id = 'post-images';
