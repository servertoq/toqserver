import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, deletion_requested_at")
    .eq("id", user.id)
    .maybeSingle();

  const isBanned = Boolean(profile?.is_banned);

  // Login / sessão ativa cancela exclusão pendente (reativa a conta).
  if (profile?.deletion_requested_at) {
    await supabase.rpc("cancel_account_deletion");
  }

  if (path === "/api/billing/checkout" && isBanned) {
    return NextResponse.json({ error: "Conta suspensa." }, { status: 403 });
  }

  if (path.startsWith("/inicio") && isBanned && !path.startsWith("/inicio/bloqueado")) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/inicio/bloqueado";
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  return response;
}

export const config = {
  matcher: ["/inicio", "/inicio/:path*", "/api/billing/checkout"],
};
