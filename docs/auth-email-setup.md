# E-mails de autenticação Toq (Gmail + templates)

Os e-mails padrão do Supabase são feios e saem de um remetente genérico. Em produção usamos:

1. **SMTP customizado** (Gmail da Toq) → remetente `algo@toqtennis.com` / Gmail da empresa  
2. **Templates HTML** em `supabase/templates/`

## 1) Senha de app do Gmail

1. Entre na conta Google da Toq (a que vai enviar os e-mails)
2. Ative **Verificação em 2 etapas** (obrigatório)
3. Vá em [Senhas de app](https://myaccount.google.com/apppasswords)
4. Crie uma senha para “Mail” / “Outro” → nome `Supabase Toq`
5. Copie a senha de 16 caracteres (guarde — só aparece uma vez)

> Contas Google Workspace (`@toqtennis.com.br`) também funcionam com senha de app, se o admin permitir.

## 2) SMTP no Supabase

Dashboard → **Authentication** → **Emails** → **SMTP Settings** (ou [Auth SMTP](https://supabase.com/dashboard/project/zkomrypjcoxxogiwpbjo/auth/smtp))

| Campo | Valor |
|-------|--------|
| Enable custom SMTP | On |
| Sender email | o Gmail da Toq (ex. `contato@toqtennis.com.br` ou `servertoq@gmail.com`) |
| Sender name | `Toq Tennis` |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | o mesmo e-mail do sender |
| Password | a **senha de app** (não a senha normal da conta) |

Salve. Desative **link tracking** se o provedor tiver (no Gmail não há).

## 3) Template de recuperação de senha

Dashboard → **Authentication** → **Email Templates** → **Reset password**

- **Subject:** `Redefinir senha — Toq Tennis`
- **Body:** cole o conteúdo de [`supabase/templates/recovery.html`](../supabase/templates/recovery.html)

O botão usa `{{ .ConfirmationURL }}` (obrigatório).

Opcional — confirmação de cadastro: cole [`confirmation.html`](../supabase/templates/confirmation.html) em **Confirm signup**, subject `Confirme seu e-mail — Toq Tennis`.

## 4) Testar

1. No app: Esqueci a senha → digite um e-mail real
2. Confira a caixa de entrada (e spam na primeira vez)
3. Remetente deve aparecer como **Toq Tennis** / seu Gmail
4. O link deve abrir `toqtennis.com.br` (Site URL + Redirect URLs já configurados)

## Observações

- SMTP padrão do Supabase tem limite baixo de e-mails/hora — custom SMTP é o caminho certo para produção.
- Gmail pessoal (`@gmail.com`) costuma cair em **spam** na 1ª vez. Peça ao destinatário marcar “Não é spam”.
- Para deliverability boa de verdade: e-mail no domínio `toqtennis.com.br` (Google Workspace) ou Resend/SendGrid com DNS (SPF/DKIM/DMARC) no domínio.
- Não cole a URL longa do token em texto puro no template — parece phishing e piora spam.
- Não commite senhas de app no git.
