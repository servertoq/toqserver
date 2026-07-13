# Handoff — Cloudflare + domínio toqtennis.com.br

Atualizado: 2026-07-13. **Setup principal concluído.**

## Objetivo
Cloudflare (proxy) na frente da Vercel, SSL, segurança básica, e-mail Auth via Resend.

## Estado atual

| Item | Status |
|------|--------|
| Domínio na Vercel | OK — `toqtennis.com.br` |
| Cloudflare | **Active** — conta `servertoq@gmail.com` |
| Nameservers | `kyle.ns.cloudflare.com` / `lina.ns.cloudflare.com` |
| DNS | CNAME `@` e `www` → `cname.vercel-dns.com` (Proxied) |
| Proxy | OK — header `cf-ray` / `server: cloudflare` |
| Canônico | Apex → **308** → `www` (usar `www` em webhooks e `NEXT_PUBLIC_APP_URL`) |
| SSL / HTTPS | Full (strict) + Always Use HTTPS |
| Security | Bot Fight + Browser Integrity On; Under Attack Off |
| Resend | **Verified** — `mail.toqtennis.com.br` (DNS via integração Cloudflare) |
| SMTP Supabase | Resend — remetente `noreply@mail.toqtennis.com.br` (reset de senha OK na inbox) |
| Stripe (test) | Checkout + webhook `https://www.toqtennis.com.br/api/billing/webhook` OK |
| Login Google | OK — callback `https://zkomrypjcoxxogiwpbjo.supabase.co/auth/v1/callback` |
| `NEXT_PUBLIC_APP_URL` | `https://www.toqtennis.com.br` |
| GitHub | Ainda público — **privar quando puder** |

## Manutenção / não reinventar

- NS Cloudflare: só `kyle` / `lina`
- Não apagar CNAME `@` / `www` do site ao mexer em DNS de e-mail
- Raiz ainda pode ter SPF `-all` / DMARC `reject`; envio Auth sai de `mail.…`
- Google OAuth redirect: `https://zkomrypjcoxxogiwpbjo.supabase.co/auth/v1/callback`
- Projeto Supabase do app: `zkomrypjcoxxogiwpbjo` (não `fusiidqqsjruzibkjmwh`)
- Guias: [`docs/auth-email-setup.md`](auth-email-setup.md)

## Scripts (opcional)

```powershell
$env:CLOUDFLARE_API_TOKEN="..."
node scripts/setup-cloudflare.mjs
node scripts/validate-cloudflare.mjs
```

## Pendências leves (fora do core Cloudflare)

1. Privar o repositório GitHub
2. Stripe **live** quando for cobrança real (`pk_live` / `sk_live` + webhook live)
3. Branding OAuth Google (nome/logo no Google Cloud) / custom domain Auth (pago) se quiser tirar `*.supabase.co` da tela de consentimento
4. Ban no servidor (middleware) — endurecimento de segurança

## Prompt rápido (outro PC / chat novo)

> Domínio Toq já no Cloudflare Active + Resend verificado + Stripe test OK. Lê `docs/handoff-cloudflare.md` e `docs/auth-email-setup.md` antes de mexer em DNS/domínio.
