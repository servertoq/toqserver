import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildMediaObjectKey,
  isAllowedMediaFolder,
  MEDIA_API_MAX_BYTES,
  sanitizeMediaSegment,
} from "@/lib/mediaObjectKey";
import { createR2PresignedPut } from "@/lib/r2";
import type { MediaFolder } from "@/lib/mediaUpload";

export const runtime = "nodejs";

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
    if (!isAllowedMediaFolder(folder)) {
      return NextResponse.json({ error: "Pasta inválida." }, { status: 400 });
    }

    const size = Number(body.size ?? 0);
    if (!Number.isFinite(size) || size <= 0 || size > MEDIA_API_MAX_BYTES) {
      return NextResponse.json({ error: "Tamanho de arquivo inválido." }, { status: 400 });
    }

    const contentType = (body.contentType || "application/octet-stream").slice(0, 120);
    const ext = sanitizeMediaSegment(body.ext || "bin").slice(0, 8) || "bin";
    const key = buildMediaObjectKey({
      userId: user.id,
      folder,
      pathPrefix: body.pathPrefix || "",
      ext,
    });
    const signed = await createR2PresignedPut({ key, contentType });
    return NextResponse.json(signed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
