import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("profile_complete, is_banned")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_banned) {
          return NextResponse.redirect(`${origin}/inicio/bloqueado`);
        }

        if (profile && profile.profile_complete === false) {
          return NextResponse.redirect(`${origin}/?complete=1`);
        }
      }

      const destination =
        next === "/" || next === ""
          ? "/inicio"
          : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
