/**
 * Configura Cloudflare na frente do toqtennis.com.br (proxy → Vercel).
 *
 * Pré-requisitos (manuais, uma vez):
 * 1. Conta Cloudflare → Add site → toqtennis.com.br
 * 2. No Registro.br, trocar nameservers para os que o Cloudflare mostrar
 * 3. Criar API Token: My Profile → API Tokens → Create Token
 *    Template "Edit zone DNS" + permissões Zone Settings Edit / Zone WAF Edit
 * 4. Rodar:
 *    $env:CLOUDFLARE_API_TOKEN="seu_token"
 *    node scripts/setup-cloudflare.mjs
 *
 * Opcional:
 *    $env:CLOUDFLARE_ZONE="toqtennis.com.br"
 *    $env:VERCEL_DNS_TARGET="cname.vercel-dns.com"
 */

const API = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = process.env.CLOUDFLARE_ZONE || "toqtennis.com.br";
const VERCEL_TARGET = process.env.VERCEL_DNS_TARGET || "cname.vercel-dns.com";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;

if (!TOKEN) {
  console.error(`
Falta CLOUDFLARE_API_TOKEN.

1) Cloudflare → Add site → ${ZONE_NAME}
2) Registro.br → DNS → Nameservers → usar os do Cloudflare
3) Cloudflare → My Profile → API Tokens → Create Token (Edit zone DNS + Zone Settings Edit)
4) PowerShell:
   $env:CLOUDFLARE_API_TOKEN="cole_o_token"
   node scripts/setup-cloudflare.mjs
`);
  process.exit(1);
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

async function upsertDns(zoneId, record) {
  const existing = await cf(
    `/zones/${zoneId}/dns_records?type=${encodeURIComponent(record.type)}&name=${encodeURIComponent(record.name)}`
  );
  const match = (existing || []).find(
    (r) => r.name === record.name || r.name === `${record.name}.`
  );
  if (match) {
    console.log(`  DNS update ${record.type} ${record.name} → ${record.content} (proxied=${record.proxied})`);
    return cf(`/zones/${zoneId}/dns_records/${match.id}`, {
      method: "PUT",
      body: {
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied,
        ttl: 1,
      },
    });
  }
  console.log(`  DNS create ${record.type} ${record.name} → ${record.content} (proxied=${record.proxied})`);
  return cf(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: {
      type: record.type,
      name: record.name,
      content: record.content,
      proxied: record.proxied,
      ttl: 1,
    },
  });
}

async function patchSetting(zoneId, id, value) {
  console.log(`  Setting ${id} = ${JSON.stringify(value)}`);
  try {
    return await cf(`/zones/${zoneId}/settings/${id}`, {
      method: "PATCH",
      body: { value },
    });
  } catch (e) {
    console.warn(`  ! ${id}: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`\n→ Zona: ${ZONE_NAME}`);
  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  const zone = zones?.[0];
  if (!zone) {
    throw new Error(
      `Zona ${ZONE_NAME} não encontrada. Adicione o site no Cloudflare primeiro e troque os nameservers no Registro.br.`
    );
  }
  console.log(`  zone_id=${zone.id} status=${zone.status}`);
  if (zone.status !== "active") {
    console.warn(
      `  ! Status ainda é "${zone.status}". Conclua a troca de nameservers no Registro.br e espere ficar "active".`
    );
  }

  console.log("\n→ DNS (Vercel + proxy laranja)");
  // Apex: CNAME flattening no Cloudflare
  await upsertDns(zone.id, {
    type: "CNAME",
    name: ZONE_NAME,
    content: VERCEL_TARGET,
    proxied: true,
  });
  await upsertDns(zone.id, {
    type: "CNAME",
    name: `www.${ZONE_NAME}`,
    content: VERCEL_TARGET,
    proxied: true,
  });

  console.log("\n→ SSL / HTTPS");
  await patchSetting(zone.id, "ssl", "strict");
  await patchSetting(zone.id, "always_use_https", "on");
  await patchSetting(zone.id, "min_tls_version", "1.2");

  console.log("\n→ Segurança");
  await patchSetting(zone.id, "security_level", "medium");
  await patchSetting(zone.id, "browser_check", "on");
  await patchSetting(zone.id, "email_obfuscation", "on");

  try {
    console.log("  Bot Fight Mode…");
    await cf(`/zones/${zone.id}/bot_management`, {
      method: "PUT",
      body: { fight_mode: true },
    });
    console.log("  Bot Fight Mode = on");
  } catch (e) {
    // Free plan: setting bot_fight_mode
    await patchSetting(zone.id, "bot_fight_mode", "on");
  }

  console.log(`
Pronto (API).

Checklist manual restante:
- Vercel → Domains: ${ZONE_NAME} e www.${ZONE_NAME} adicionados
- Vercel env NEXT_PUBLIC_APP_URL=https://${ZONE_NAME}
- Testar https://${ZONE_NAME} (header cf-ray)
- Login Google + esqueci senha
`);
}

main().catch((err) => {
  console.error("\nFalhou:", err.message);
  process.exit(1);
});
