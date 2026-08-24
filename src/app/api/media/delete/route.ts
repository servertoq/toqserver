import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteR2Object, r2KeyFromPublicUrl } from "@/lib/r2";

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

    const body = (await request.json()) as { url?: string; key?: string };
    let key = body.key?.trim() || null;
    if (!key && body.url) {
      key = r2KeyFromPublicUrl(body.url);
    }

    if (!key) {
      // URL antiga do Supabase Storage — ignora sem erro (nada a apagar no R2).
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Só permite apagar objetos sob a pasta do próprio usuário
    const owns =
      key.includes(`/${user.id}/`) ||
      key.startsWith(`avatars/${user.id}/`) ||
      key.startsWith(`profile-photos/${user.id}/`);

    if (!owns) {
      return NextResponse.json({ error: "Sem permissão para este arquivo." }, { status: 403 });
    }

    await deleteR2Object(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao remover.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
