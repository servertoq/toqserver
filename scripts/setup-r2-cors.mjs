/**
 * Aplica a política CORS do bucket R2 (docs/r2-cors.json).
 *
 * O R2 não aceita AllowedHeaders: ["*"] — use Content-Type explícito.
 *
 * Uso (PowerShell):
 *   $env:CLOUDFLARE_API_TOKEN="seu_token"
 *   $env:R2_ACCOUNT_ID="seu_account_id"
 *   node scripts/setup-r2-cors.mjs
 *
 * Token: permissão "Workers R2 Storage Write" ou R2 Admin no account.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim() ?? "";
const BUCKET = process.env.R2_BUCKET_NAME?.trim() || "toq-tennis";

const here = dirname(fileURLToPath(import.meta.url));
const corsPath = join(here, "..", "docs", "r2-cors.json");

if (!TOKEN || !ACCOUNT_ID) {
  console.error(`
Faltam variáveis de ambiente.

  $env:CLOUDFLARE_API_TOKEN="token_com_permissao_R2"
  $env:R2_ACCOUNT_ID="account_id"
  node scripts/setup-r2-cors.mjs
`);
  process.exit(1);
}

function toApiRules(dashboardRules) {
  return dashboardRules.map((rule, index) => ({
    id: rule.id ?? `rule-${index + 1}`,
    allowed: {
      origins: rule.AllowedOrigins ?? [],
      methods: rule.AllowedMethods ?? [],
      headers: rule.AllowedHeaders ?? [],
    },
    exposeHeaders: rule.ExposeHeaders ?? [],
    maxAgeSeconds: rule.MaxAgeSeconds ?? 3600,
  }));
}

async function cf(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    const msgs = (json.errors || []).map((e) => e.message).join("; ") || res.statusText;
    throw new Error(`${method} ${path}: ${msgs}`);
  }
  return json.result;
}

async function main() {
  const raw = readFileSync(corsPath, "utf8");
  const dashboardRules = JSON.parse(raw);
  const rules = toApiRules(dashboardRules);

  console.log(`Aplicando CORS em R2 bucket "${BUCKET}" (account ${ACCOUNT_ID})…`);
  await cf(`/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/cors`, {
    method: "PUT",
    body: { rules },
  });

  const current = await cf(`/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/cors`);
  console.log("CORS atual:", JSON.stringify(current, null, 2));
  console.log("\nOK. Teste upload no perfil (foto + carrossel).");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
