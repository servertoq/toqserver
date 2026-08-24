/**
 * Compressão client-side: mantém resolução (até maxEdge),
 * reduz bytes com WebP/JPEG de alta qualidade.
 */

export const MEDIA_MAX_IMAGE_EDGE = 4096;
/** Qualidade quase máxima — prioriza nitidez; WebP ainda reduz bastante o tamanho. */
export const MEDIA_IMAGE_QUALITY = 0.95;
export const MEDIA_MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MEDIA_MAX_IMAGE_BYTES_AFTER = 12 * 1024 * 1024;

export type MediaFolder =
  | "avatars"
  | "profile-photos"
  | "post-images"
  | "community-covers"
  | "club-court-images"
  | "club-product-images"
  | "club-tournament-images"
  | "support-images"
  | "advertising-images";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Falha ao comprimir a imagem."));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

function supportsWebp(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

/**
 * Comprime imagem mantendo aspect ratio.
 * Só reduz dimensões se um lado passar de maxEdge.
 * JPEG já processado (ex.: crop do post) com qualidade alta: evita 2ª reencode pesada
 * se já estiver abaixo do limite de tamanho.
 */
export async function compressImageFile(
  file: File,
  opts?: { maxEdge?: number; quality?: number }
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  // JPEG recente do crop do post: se já é razoável, sobe sem recomprimir.
  if (
    (file.type === "image/jpeg" || file.type === "image/webp") &&
    file.size <= 4 * 1024 * 1024 &&
    file.name.includes("post-image")
  ) {
    return file;
  }

  const maxEdge = opts?.maxEdge ?? MEDIA_MAX_IMAGE_EDGE;
  const quality = opts?.quality ?? MEDIA_IMAGE_QUALITY;
  const img = await loadImage(file);

  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const scale = maxEdge / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const useWebp = supportsWebp();
  const mime = useWebp ? "image/webp" : "image/jpeg";
  const blob = await canvasToBlob(canvas, mime, quality);

  // Se a compressão ficou maior que o original (raro), mantém o original.
  if (blob.size >= file.size && file.type !== "image/png") {
    return file;
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  const ext = useWebp ? "webp" : "jpg";
  return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
}

export async function prepareMediaFile(file: File): Promise<File> {
  if (file.type.startsWith("video/")) {
    if (file.size > MEDIA_MAX_VIDEO_BYTES) {
      throw new Error("Vídeo muito grande (máx. 80 MB). Comprima antes de enviar.");
    }
    return file;
  }
  if (file.type.startsWith("image/")) {
    const compressed = await compressImageFile(file);
    if (compressed.size > MEDIA_MAX_IMAGE_BYTES_AFTER) {
      throw new Error("Imagem ainda muito grande após compressão. Tente outra foto.");
    }
    return compressed;
  }
  throw new Error("Formato de mídia não suportado.");
}

export function mediaExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "video/webm") return "webm";
  if (file.type === "video/quicktime") return "mov";
  if (file.type.startsWith("video/")) return "mp4";
  return "bin";
}

export type UploadMediaResult = {
  publicUrl: string;
  key: string;
  contentType: string;
};

/**
 * Comprime (imagens) e envia direto ao R2 via URL pré-assinada (baixa memória no servidor).
 */
export async function uploadMediaToR2(
  file: File,
  opts: { folder: MediaFolder; pathPrefix: string }
): Promise<UploadMediaResult> {
  const prepared = await prepareMediaFile(file);
  const ext = mediaExtension(prepared);

  const presignRes = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folder: opts.folder,
      pathPrefix: opts.pathPrefix,
      contentType: prepared.type || "application/octet-stream",
      ext,
      size: prepared.size,
    }),
  });

  const presign = (await presignRes.json()) as {
    uploadUrl?: string;
    publicUrl?: string;
    key?: string;
    error?: string;
  };

  if (!presignRes.ok || !presign.uploadUrl || !presign.publicUrl || !presign.key) {
    throw new Error(presign.error || "Não foi possível preparar o upload.");
  }

  let putRes: Response;
  try {
    putRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      body: prepared,
      headers: {
        "Content-Type": prepared.type || "application/octet-stream",
      },
    });
  } catch {
    throw new Error(
      "Upload bloqueado pelo navegador (CORS). No Cloudflare → R2 → bucket toq-tennis → Settings → CORS, cole o JSON de docs/r2-cors.json."
    );
  }

  if (!putRes.ok) {
    const detail = (await putRes.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Falha ao enviar para o R2 (${putRes.status})${detail ? `: ${detail}` : ""}.`
    );
  }

  return {
    publicUrl: `${presign.publicUrl}?t=${Date.now()}`,
    key: presign.key,
    contentType: prepared.type,
  };
}

export async function deleteMediaFromR2(publicUrl: string): Promise<void> {
  const res = await fetch("/api/media/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: publicUrl }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Não foi possível remover o arquivo.");
  }
}
