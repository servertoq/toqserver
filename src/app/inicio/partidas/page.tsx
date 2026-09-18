import { Suspense } from "react";
import { PartidasPage } from "@/components/partidas/PartidasPage";
import { appContentClass } from "@/lib/layout";

export default function PartidasRoutePage() {
  return (
    <Suspense
      fallback={
        <main className={appContentClass}>
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
        </main>
      }
    >
      <PartidasPage />
    </Suspense>
  );
}
