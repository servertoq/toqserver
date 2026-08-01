/** URL canônica do app (produção: https://www.toqtennis.com.br). */
export function getPublicAppUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "https://www.toqtennis.com.br";
}

/** Origem para redirects no Route Handler (evita apex vs www). */
export function resolveRequestSiteUrl(request: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${proto}://${forwardedHost.split(",")[0].trim()}`;
  }

  return new URL(request.url).origin;
}
