# E-mails de autenticação Toq (Resend + templates)

Os e-mails padrão do Supabase são feios e saem de um remetente genérico. Em produção usamos:

1. **Resend** (SMTP) com domínio `toqtennis.com.br` verificado → sai da caixa de spam do Gmail  
2. **Templates HTML** em `supabase/templates/`

> Gmail pessoal (`servertoq@gmail.com`) como SMTP **não** resolve deliverability — provedores tratam como suspeito. Resend + SPF/DKIM no domínio é o caminho certo.

## 1) Domínio no Resend (obrigatório no free)

1. Entre em [resend.com/domains](https://resend.com/domains) → **Add Domain**
2. Preferência: subdomínio só de e-mail, ex. `mail.toqtennis.com.br` (isola reputação do site)
   - Alternativa: `toqtennis.com.br` (raiz) também funciona
3. Resend mostra registros DNS (MX, TXT SPF, TXT DKIM — e às vezes DMARC)
4. Cadastre esses registros **onde o DNS do domínio estiver ativo agora**:
   - Enquanto NS forem Registro.br → zona do Registro.br
   - Depois que Cloudflare estiver **Active** → DNS do Cloudflare (e remova duplicatas no Registro.br)
5. No Resend → **Verify DNS Records** (costuma levar alguns minutos)

Remetente válido depois da verificação, exemplos:

- `noreply@mail.toqtennis.com.br`
- ou `noreply@toqtennis.com.br` se verificou a raiz

## 2) API key no Resend

1. [API Keys](https://resend.com/api-keys) → **Create API Key**
2. Nome: `Supabase Toq Auth`
3. Permissão: Sending access
4. Copie a key (`re_...`) — só aparece uma vez. **Não** commit no git.

## 3) SMTP no Supabase

Dashboard → **Authentication** → **Emails** → **SMTP Settings**  
([atalho](https://supabase.com/dashboard/project/zkomrypjcoxxogiwpbjo/auth/smtp))

| Campo | Valor |
|-------|--------|
| Enable custom SMTP | On |
| Sender email | `noreply@mail.toqtennis.com.br` (o domínio **verificado** no Resend) |
| Sender name | `Toq Tennis` |
| Host | `smtp.resend.com` |
| Port | `465` (ou `587` se 465 falhar) |
| Username | `resend` |
| Password | a API key `re_...` |

Salve. Opcional: integração one-click em Resend → **Integrations** → Supabase (faz o mesmo).

Depois de ativar SMTP custom, no Auth → **Rate Limits** aumente o limite de e-mails/hora se o Dashboard avisar (padrão do Supabase fica baixo).

## 4) Templates

Dashboard → **Authentication** → **Email Templates** → **Reset password**

- **Subject:** `Redefinir senha — Toq Tennis`
- **Body:** cole [`supabase/templates/recovery.html`](../supabase/templates/recovery.html)

Confirmação de cadastro (opcional): [`confirmation.html`](../supabase/templates/confirmation.html), subject `Confirme seu e-mail — Toq Tennis`.

## 5) Testar

1. App → Esqueci a senha → e-mail real
2. Caixa de entrada (não só spam)
3. Remetente: **Toq Tennis** / `noreply@…toqtennis.com.br`
4. No Resend → **Emails** / Logs: status `delivered`
5. Link deve abrir `toqtennis.com.br` (Site URL + Redirect URLs)

## Observações

- Sem domínio verificado, o Resend free só envia para o e-mail da sua conta (teste) — **não** serve para usuários.
- Desative open/click tracking no domínio Resend se a opção existir (Auth não precisa e pode piorar spam).
- Custom Domain no Supabase Auth (pago) alinha links do e-mail com o domínio — ajuda mais ainda, mas não é obrigatório para sair do spam com Resend.
- Não cole a URL longa do token em texto puro no template.
- Não commite API keys no git.

## Legado (não usar em produção)

Gmail SMTP (`smtp.gmail.com` + senha de app) foi o setup temporário. Remova do Supabase quando Resend estiver verified + SMTP salvo.
