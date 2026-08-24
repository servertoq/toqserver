import Image from "next/image";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ until?: string }>;
};

export default async function ContaExclusaoPage({ searchParams }: Props) {
  const { until } = await searchParams;
  let untilLabel: string | null = null;
  if (until) {
    const d = new Date(until);
    if (!Number.isNaN(d.getTime())) {
      untilLabel = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center">
      <div className="relative h-12 w-[7.5rem] shrink-0" aria-label="Toq Tennis" role="img">
        <Image
          src="/imagens_publicas/logo_sidebar.png"
          alt="TOQ"
          fill
          sizes="120px"
          className="object-contain object-center"
          priority
        />
      </div>
      <h1 className="mt-6 text-xl font-bold text-[var(--toq-navy)]">
        Conta programada para exclusão
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--toq-text-muted)]">
        Sua conta ficará inativa por 30 dias
        {untilLabel ? (
          <>
            {" "}
            (exclusão prevista para <span className="font-semibold text-[var(--toq-text)]">{untilLabel}</span>)
          </>
        ) : null}
        . Dois dias antes você receberá um e-mail de aviso. Se fizer login antes do prazo, a exclusão
        é cancelada e a conta reativa automaticamente.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl toq-btn-primary px-6 py-2.5 text-sm font-bold text-white"
      >
        Fazer login para reativar
      </Link>
    </main>
  );
}
