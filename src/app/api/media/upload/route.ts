import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildMediaObjectKey,
  isAllowedMediaFolder,
  SERVER_UPLOAD_MAX_BYTES,
} from "@/lib/mediaObjectKey";
import { mediaExtension } from "@/lib/mediaUpload";
import { putR2Object, r2PublicUrlForKey } from "@/lib/r2";

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

    const form = await request.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") ?? "");
    const pathPrefix = String(form.get("pathPrefix") ?? "");

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
    }

    if (!isAllowedMediaFolder(folderRaw)) {
      return NextResponse.json({ error: "Pasta inválida." }, { status: 400 });
    }

    if (file.size > SERVER_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Imagem muito grande (máx. ${Math.round(SERVER_UPLOAD_MAX_BYTES / (1024 * 1024))} MB). Tente outra foto.`,
        },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Upload direto só para imagens. Vídeos usam outro fluxo." },
        { status: 400 }
      );
    }

    const ext = mediaExtension(file);
    const contentType = file.type || "application/octet-stream";
    const key = buildMediaObjectKey({
      userId: user.id,
      folder: folderRaw,
      pathPrefix,
      ext,
    });

    const body = Buffer.from(await file.arrayBuffer());
    await putR2Object({ key, body, contentType });

    return NextResponse.json({
      key,
      publicUrl: r2PublicUrlForKey(key),
      contentType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
