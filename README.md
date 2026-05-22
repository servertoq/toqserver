# Toq Tennis

Rede social + SaaS de jogos de tênis.

## Início rápido

1. **Supabase** — no [SQL Editor](https://supabase.com/dashboard), execute o arquivo inteiro:
   `supabase/migrations/001_toq_tennis_initial.sql`

2. **Painel Supabase**
   - Authentication → Providers → ative **Google** (Client ID / Secret do Google Cloud)
   - Authentication → URL Configuration:
     - Site URL: `http://localhost:3000`
     - Redirect URLs: `http://localhost:3000/auth/callback`

3. **Variáveis de ambiente**
   ```bash
   cp .env.local.example .env.local
   ```
   Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

4. **Rodar o app**
   ```bash
   npm install
   npm run dev
   ```

Acesse [http://localhost:3000](http://localhost:3000) — tela única de login/cadastro sem scroll na página.

## Logo

- Original: `imagens_publicas/logo.jpg`
- Servida pelo Next.js: `public/imagens_publicas/logo.jpg` (favicon e UI)
