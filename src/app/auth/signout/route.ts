import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    });

    try {
      await Promise.race([
        supabase.auth.signOut({ scope: "local" }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      /* segue para limpar cookies manualmente */
    }
  }

  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) {
      cookieStore.delete(c.name);
    }
  }

  return NextResponse.redirect(new URL("/", request.url), { status: 302 });
}
