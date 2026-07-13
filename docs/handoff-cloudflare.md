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
| Stripe (live) | **Pendente** — confirmar identidade na Stripe; depois trocar keys + webhook live |
| Login Google | OK — callback `https://zkomrypjcoxxogiwpbjo.supabase.co/auth/v1/callback` |
| OAuth branding | Nome/logo Toq no Google Cloud (URL `*.supabase.co` só some com Custom Domain Pro) |
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
2. **Stripe live** (continuar no PC de casa após KYC):
   - Desligar Test mode → ativar conta (identidade / empresa / banco)
   - Vercel + `.env.local`: `STRIPE_SECRET_KEY=sk_live_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`
   - Webhook **Live** → `https://www.toqtennis.com.br/api/billing/webhook` (`checkout.session.completed`)
   - `STRIPE_WEBHOOK_SECRET` = `whsec_…` **do live** (não reutilizar o de test)
   - Redeploy Vercel
   - Modelo atual: cobrança **única** da diferença no upgrade (não é assinatura mensal automática)
3. Custom domain Auth (Pro) se quiser tirar `*.supabase.co` da tela do Google

## Já feito (segurança app)

- Proteção de `plan` / `ban` via trigger (migration 067)
- Ban no servidor: middleware + layout + checkout → `/inicio/bloqueado` (redirect direto no login)
- Onboarding Google (migration 068)

## Prompt rápido (outro PC / chat novo)

> `git pull`. Continua Stripe **live**: KYC na Stripe feito?; depois keys live + webhook www + redeploy. Lê `docs/handoff-cloudflare.md`. Modelo de plano = pagamento único da diferença (não subscription).
