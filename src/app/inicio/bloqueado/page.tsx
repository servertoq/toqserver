import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function BloqueadoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, banned_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_banned) {
    redirect("/inicio");
  }

  const reason = profile.banned_reason?.trim();

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-bold text-[var(--toq-navy)]">Conta suspensa</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--toq-text-muted)]">
        Sua conta foi suspensa pela moderação da Toq Tennis.
        {reason ? (
          <>
            {" "}
            Motivo: <span className="font-medium text-[var(--toq-text)]">{reason}</span>.
          </>
        ) : null}{" "}
        Se acredita que houve um engano, entre em contato em{" "}
        <a
          href="mailto:servertoq@gmail.com"
          className="font-semibold text-[var(--toq-accent)]"
        >
          servertoq@gmail.com
        </a>
        .
      </p>
      <a
        href="/auth/signout"
        className="mt-8 rounded-xl toq-btn-primary px-6 py-2.5 text-sm font-bold text-white"
      >
        Sair da conta
      </a>
    </main>
  );
}
