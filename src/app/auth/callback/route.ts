import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveRequestSiteUrl } from "@/lib/siteUrl";

type CookieToSet = { name: string; value: string; options: CookieOptions };

function applyCookies(response: NextResponse, cookiesToSet: CookieToSet[]) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const siteUrl = resolveRequestSiteUrl(request);

  if (code) {
    const cookieStore = await cookies();
    const pendingCookies: CookieToSet[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              pendingCookies.push({ name, value, options });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let destination =
        next === "/" || next === "" ? "/inicio" : next;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("profile_complete, is_banned, deletion_requested_at")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.deletion_requested_at) {
          await supabase.rpc("cancel_account_deletion");
        }

        if (profile?.is_banned) {
          destination = "/inicio/bloqueado";
        } else if (profile && profile.profile_complete === false) {
          destination = "/?complete=1";
        }
      }

      return applyCookies(
        NextResponse.redirect(`${siteUrl}${destination}`),
        pendingCookies
      );
    }
  }

  return NextResponse.redirect(`${siteUrl}/?error=auth`);
}
