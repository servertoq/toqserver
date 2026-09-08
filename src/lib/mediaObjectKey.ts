import type { MediaFolder } from "@/lib/mediaUpload";

export const MEDIA_API_MAX_BYTES = 80 * 1024 * 1024;
/** Limite prático para upload via API (Vercel ~4,5 MB). Vídeos usam URL pré-assinada. */
export const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_FOLDERS = new Set<MediaFolder>([
  "avatars",
  "profile-photos",
  "post-images",
  "community-covers",
  "club-court-images",
  "club-product-images",
  "club-tournament-images",
  "support-images",
  "advertising-images",
]);

export function isAllowedMediaFolder(folder: string | undefined): folder is MediaFolder {
  return Boolean(folder && ALLOWED_FOLDERS.has(folder as MediaFolder));
}

export function sanitizeMediaSegment(value: string) {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => p.replace(/[^a-zA-Z0-9._-]/g, ""))
    .filter(Boolean)
    .join("/");
}

export function buildMediaObjectKey(params: {
  userId: string;
  folder: MediaFolder;
  pathPrefix: string;
  ext: string;
}) {
  const ext = sanitizeMediaSegment(params.ext || "bin").slice(0, 8) || "bin";
  const rawPrefix = sanitizeMediaSegment(params.pathPrefix || "");
  const prefix = rawPrefix.startsWith(params.userId)
    ? rawPrefix
    : [params.userId, rawPrefix].filter(Boolean).join("/");

  return `${params.folder}/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
