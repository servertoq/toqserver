# E-mails de autenticação Toq (Resend + templates)

Os e-mails padrão do Supabase são feios e saem de um remetente genérico. Em produção usamos:

1. **Resend** (SMTP) com domínio `mail.toqtennis.com.br` **Verified** → remetente `noreply@mail.toqtennis.com.br`
2. **Templates HTML** em `supabase/templates/`

> Gmail pessoal (`servertoq@gmail.com`) como SMTP **não** resolve deliverability. Resend + SPF/DKIM no subdomínio `mail` é o caminho em uso.

## Estado (2026-07-13)

| Item | Status |
|------|--------|
| Domínio Resend | `mail.toqtennis.com.br` — Verified (Cloudflare) |
| SMTP Supabase | `smtp.resend.com` / user `resend` / sender `noreply@mail.toqtennis.com.br` |
| Reset de senha | Testado — chega na inbox com logo |

## 1) Domínio no Resend

Já feito: [resend.com/domains](https://resend.com/domains) → `mail.toqtennis.com.br` (integração Cloudflare OK).

Se precisar recriar: preferência subdomínio `mail.…` (isola reputação da raiz, que pode ter SPF `-all` / DMARC reject).

## 2) API key no Resend

1. [API Keys](https://resend.com/api-keys) → **Create API Key**
2. Nome: `Supabase Toq Auth`
3. Copie `re_...` — **não** commit no git

## 3) SMTP no Supabase

Dashboard → **Authentication** → **Emails** → **SMTP Settings**  
([atalho](https://supabase.com/dashboard/project/zkomrypjcoxxogiwpbjo/auth/smtp))

| Campo | Valor |
|-------|--------|
| Enable custom SMTP | On |
| Sender email | `noreply@mail.toqtennis.com.br` |
| Sender name | `Toq Tennis` |
| Host | `smtp.resend.com` |
| Port | `465` (ou `587` se 465 falhar) |
| Username | `resend` |
| Password | API key `re_...` |

## 4) Templates

- **Reset password** subject: `Redefinir senha — Toq Tennis` · body: [`recovery.html`](../supabase/templates/recovery.html)
- **Confirm signup** (opcional): [`confirmation.html`](../supabase/templates/confirmation.html)

## 5) Testar

1. App → Esqueci a senha
2. Inbox + Resend → Logs (`delivered`)
3. Link deve abrir `www.toqtennis.com.br` (Site URL / redirects)

## Observações

- Não cole a URL longa do token em texto puro no template
- Não commit API keys
- Legado Gmail SMTP: não usar em produção
