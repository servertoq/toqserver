export function SupabaseConfigMissing() {
  return (
    <main className="auth-panel-login flex h-dvh items-center justify-center px-6">
      <div className="auth-form-card max-w-md rounded-2xl p-6 text-center">
        <h1 className="text-lg font-bold">Configuração do Supabase</h1>
        <p className="mt-3 text-sm text-[var(--toq-muted)]">
          Crie o arquivo <code className="text-white">.env.local</code> na raiz do
          projeto (copie de <code className="text-white">.env.local.example</code>) e
          preencha:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-[rgba(0,0,64,0.45)] p-3 text-left text-xs text-[var(--toq-muted)]">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon`}
        </pre>
        <p className="mt-4 text-xs text-[var(--toq-muted)]">
          Valores em: Supabase Dashboard → Settings → API. Depois reinicie com{" "}
          <code className="text-white">npm run dev</code>.
        </p>
      </div>
    </main>
  );
}
