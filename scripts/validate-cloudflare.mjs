/**
 * Valida se toqtennis.com.br está atrás do Cloudflare e respondendo.
 * Uso: node scripts/validate-cloudflare.mjs
 */
const HOST = process.env.CLOUDFLARE_ZONE || "toqtennis.com.br";

async function check(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const headers = Object.fromEntries(res.headers.entries());
    return {
      url,
      ok: res.ok,
      status: res.status,
      server: headers.server || null,
      cfRay: headers["cf-ray"] || null,
      cfCache: headers["cf-cache-status"] || null,
    };
  } catch (e) {
    return { url, ok: false, error: e.message };
  }
}

async function main() {
  const apex = await check(`https://${HOST}`);
  const www = await check(`https://www.${HOST}`);
  console.log(JSON.stringify({ apex, www }, null, 2));

  const proxied = Boolean(apex.cfRay);
  if (!apex.ok) {
    console.error("\nSite apex não responde. Confira DNS / nameservers / Vercel Domains.");
    process.exit(1);
  }
  if (!proxied) {
    console.error("\nResponde, mas sem header cf-ray — ainda não está no proxy Cloudflare (nuvem laranja).");
    process.exit(2);
  }
  console.log("\nOK: HTTPS + Cloudflare proxy ativo.");
}

main();
