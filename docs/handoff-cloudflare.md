# Handoff — Cloudflare + domínio toqtennis.com.br

Atualizado: 2026-07-13. Zona **Active** (tráfego com `cf-ray`).

## Objetivo
Colocar Cloudflare (proxy laranja) na frente do site na Vercel, com SSL Full (strict) e segurança básica.

## Estado atual

| Item | Status |
|------|--------|
| Domínio na Vercel | OK — `toqtennis.com.br` cadastrado |
| Site Cloudflare | **Active** — conta `servertoq@gmail.com` |
| DNS no Cloudflare | Confirmar CNAME `@` e `www` → `cname.vercel-dns.com` (Proxied) |
| Nameservers | `kyle.ns.cloudflare.com` / `lina.ns.cloudflare.com` (público OK) |
| Proxy | OK — `www` responde com `server: cloudflare` + `cf-ray` |
| Canônico | Apex `toqtennis.com.br` redireciona **308 → www** (webhook Stripe deve usar `www`) |
| SSL | Full (strict) + Always HTTPS (confirmar) |
| Security | Bot Fight + Browser Integrity On; Under Attack Off |
| Resend | **Próximo** — domínio `mail.toqtennis.com.br` no Cloudflare |
| Stripe test | Checkout + webhook `https://www.toqtennis.com.br/api/billing/webhook` OK |
| Login Google | OK — callback `https://zkomrypjcoxxogiwpbjo.supabase.co/auth/v1/callback` |
| Supabase Site URL / Redirects | Incluir apex e `www` |
| `NEXT_PUBLIC_APP_URL` | Preferir `https://www.toqtennis.com.br` |

## Próximos passos (agora)

1. **Cloudflare → DNS** — `@` e `www` Proxied (nuvem laranja) → Vercel.

2. **Cloudflare → SSL/TLS**
   - Overview → Encryption mode: **Full (strict)**
   - Edge Certificates → **Always Use HTTPS**: On

3. **Cloudflare → Security**
   - Settings → Security Level: **Medium**
   - Bot Fight Mode: **On**
   - Browser Integrity Check: **On**

4. **Vercel** → `NEXT_PUBLIC_APP_URL=https://www.toqtennis.com.br` → Redeploy.

5. **Resend** (ver `docs/auth-email-setup.md`):
   - Domínio `mail.toqtennis.com.br` no Resend
   - DNS no Cloudflare (não apagar ainda o SPF `-all` / DMARC da **raiz** — o envio sai do subdomínio `mail`)
   - SMTP no Supabase → testar reset

6. **Validar** site, login Google, reset senha, checkout.

## Scripts no repo

```powershell
# Depois que a zona estiver Active e com token API (opcional):
$env:CLOUDFLARE_API_TOKEN="..."
node scripts/setup-cloudflare.mjs
node scripts/validate-cloudflare.mjs
```

## E-mail (paralelo ao Cloudflare)

Spam do reset de senha: migrar SMTP do Gmail → **Resend** com domínio verificado. Guia: [`docs/auth-email-setup.md`](auth-email-setup.md).

- DNS do Resend (SPF/DKIM/MX do subdomínio `mail.…`) pode ir no Registro.br **agora** ou no Cloudflare depois de Active.
- Remetente alvo: `noreply@mail.toqtennis.com.br` (ou raiz, se verificar `toqtennis.com.br`).

## O que NÃO mexer

- Google OAuth redirect: `https://zkomrypjcoxxogiwpbjo.supabase.co/auth/v1/callback`
- Não usar o projeto Supabase antigo `fusiidqqsjruzibkjmwh` (era confusão de outro MCP)

## Prompt rápido para o chat no outro PC

> Continua o handoff em `docs/handoff-cloudflare.md`. Domínio toqtennis.com.br: Cloudflare criado, falta trocar nameservers no Registro.br (kyle/lina) e depois SSL Full strict + Bot Fight. Me guia no próximo passo.
