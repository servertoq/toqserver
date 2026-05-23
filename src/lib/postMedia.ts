export type PostMediaKind = "image" | "video";

export const MAX_POST_MEDIA = 4;
export const MAX_POST_VIDEOS = 1;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const POST_IMAGE_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/gif";

export const POST_VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";

export function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function mediaKindFromFile(file: File): PostMediaKind {
  return isVideoFile(file) ? "video" : "image";
}

export function validatePostMediaFile(
  file: File,
  existing: File[]
): string | null {
  if (isVideoFile(file)) {
    if (file.size > MAX_VIDEO_BYTES) {
      return `O vídeo "${file.name}" excede 50 MB.`;
    }
    const videoCount =
      existing.filter(isVideoFile).length + (isVideoFile(file) ? 1 : 0);
    if (videoCount > MAX_POST_VIDEOS) {
      return "É permitido no máximo 1 vídeo por publicação.";
    }
    return null;
  }

  if (isImageFile(file)) {
    if (file.size > MAX_IMAGE_BYTES) {
      return `A imagem "${file.name}" excede 10 MB.`;
    }
    return null;
  }

  return `Formato não suportado: ${file.name}`;
}

export function mergePostMediaFiles(existing: File[], incoming: File[]): {
  files: File[] | null;
  error: string | null;
} {
  const next = [...existing];

  for (const file of incoming) {
    const err = validatePostMediaFile(file, next);
    if (err) return { files: null, error: err };
    next.push(file);
  }

  if (next.length > MAX_POST_MEDIA) {
    return {
      files: null,
      error: `Máximo de ${MAX_POST_MEDIA} arquivos (fotos e vídeos) por publicação.`,
    };
  }

  return { files: next, error: null };
}

export function extensionForMediaFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext) return ext;
  return isVideoFile(file) ? "mp4" : "jpg";
}
