import type { NextConfig } from "next";

/**
 * Headers de segurança (securityheaders.com / MDN Observatory).
 * CSP cobre Next.js + Supabase + Google Maps + Stripe Checkout.
 * COEP não é definido: quebra embeds (Maps) e recursos cross-origin.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // ThemeScript inline + runtime Next.js; Maps loader
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.r2.dev https://*.r2.cloudflarestorage.com https://*.toqtennis.com.br https://maps.gstatic.com https://maps.googleapis.com https://*.googleapis.com https://*.ggpht.com https://*.google.com https://*.googleusercontent.com",
  "media-src 'self' blob: https://*.supabase.co https://*.r2.dev https://*.r2.cloudflarestorage.com https://*.toqtennis.com.br",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.toqtennis.com.br https://maps.googleapis.com https://*.googleapis.com https://places.googleapis.com https://api.stripe.com https://api.mercadopago.com https://api.mercadolibre.com https://viacep.com.br https://brasilapi.com.br https://api.bigdatacloud.net https://nominatim.openstreetmap.org https://api.resend.com",
  "frame-src 'self' https://www.google.com https://maps.google.com https://www.google.com/maps/ https://www.openstreetmap.org https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://www.mercadopago.com https://www.mercadopago.com.br https://*.mercadopago.com https://*.mercadolibre.com",
  "worker-src 'self' blob:",
  "form-action 'self' https://checkout.stripe.com https://*.supabase.co https://accounts.google.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Explicitamente desliga o filtro XSS legado (obsoleto nos browsers modernos).
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.toqtennis.com.br",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
