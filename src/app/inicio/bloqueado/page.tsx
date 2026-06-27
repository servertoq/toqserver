"use client";

export default function BloqueadoPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-4xl" aria-hidden>
        ⛔
      </p>
      <h1 className="mt-4 text-xl font-bold text-[var(--toq-navy)]">Conta suspensa</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--toq-text-muted)]">
        Sua conta foi suspensa pela moderação da Toq Tennis. Se acredita que houve um engano,
        entre em contato pelo suporte em{" "}
        <a href="mailto:suporte@toqtennis.com" className="font-semibold text-[var(--toq-accent)]">
          suporte@toqtennis.com
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
