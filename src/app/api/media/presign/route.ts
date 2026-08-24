import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createR2PresignedPut } from "@/lib/r2";
import type { MediaFolder } from "@/lib/mediaUpload";

export const runtime = "nodejs";

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

const MAX_BYTES = 80 * 1024 * 1024;

function sanitizeSegment(value: string) {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => p.replace(/[^a-zA-Z0-9._-]/g, ""))
    .filter(Boolean)
    .join("/");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json()) as {
      folder?: string;
      pathPrefix?: string;
      contentType?: string;
      ext?: string;
      size?: number;
    };

    const folder = body.folder as MediaFolder | undefined;
    if (!folder || !ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: "Pasta inválida." }, { status: 400 });
    }

    const size = Number(body.size ?? 0);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
      return NextResponse.json({ error: "Tamanho de arquivo inválido." }, { status: 400 });
    }

    const contentType = (body.contentType || "application/octet-stream").slice(0, 120);
    const ext = sanitizeSegment(body.ext || "bin").slice(0, 8) || "bin";
    const rawPrefix = sanitizeSegment(body.pathPrefix || "");
    const prefix = rawPrefix.startsWith(user.id)
      ? rawPrefix
      : [user.id, rawPrefix].filter(Boolean).join("/");

    const key = `${folder}/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const signed = await createR2PresignedPut({ key, contentType });
    return NextResponse.json(signed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
