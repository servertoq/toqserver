# Handoff — Cloudflare + domínio toqtennis.com.br

Atualizado: 2026-07-13. Continuar neste arquivo após o contador do Registro.br.

## Objetivo
Colocar Cloudflare (proxy laranja) na frente do site na Vercel, com SSL Full (strict) e segurança básica.

## Estado atual

| Item | Status |
|------|--------|
| Domínio na Vercel | OK — `toqtennis.com.br` cadastrado |
| Site Cloudflare | Criado — conta `servertoq@gmail.com` |
| DNS no Cloudflare | CNAME `@` e `www` → `cname.vercel-dns.com` (Proxied) |
| Nameservers Cloudflare | `kyle.ns.cloudflare.com` / `lina.ns.cloudflare.com` |
| Nameservers Registro.br | **Pedido salvo** — kyle/lina; Registro.br indica ~2h para aplicar. Público ainda `a.sec.dns.br` / `c.sec.dns.br` |
| Cloudflare Overview | Waiting for nameserver propagation |
| SSL / Bot Fight / Security | Pendente (só depois do domínio Active no CF) |
| Login Google | OK — callback `https://zkomrypjcoxxogiwpbjo.supabase.co/auth/v1/callback` |
| Supabase Site URL | Deve ser `https://toqtennis.com.br` |
| Supabase Redirect URLs | Já incluem `toqtennis.com.br` e `www` + `/auth/callback` |

## Próximos passos (depois das ~2h do Registro.br)

1. **Cloudflare** → Overview → **Check nameservers now** até status **Active**.

2. **Cloudflare → DNS** — confirmar CNAME `@` e `www` → `cname.vercel-dns.com` (Proxied / laranja).

3. **Cloudflare → SSL/TLS**
   - Encryption mode: **Full (strict)**
   - Always Use HTTPS: On

4. **Cloudflare → Security**
   - Security Level: **Medium**
   - Bot Fight Mode: **On**
   - Browser Integrity Check: **On**

5. **Vercel** → env Production:
   - `NEXT_PUBLIC_APP_URL=https://toqtennis.com.br`
   - Redeploy se mudar a env.

6. **Validar**
   - `https://toqtennis.com.br` abre
   - Header `cf-ray` presente (DevTools → Network)
   - Login Google + “esqueci a senha”

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
