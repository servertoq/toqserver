import { Suspense } from "react";
import { TournamentsPage } from "@/components/tournaments/TournamentsPage";
import { appContentClass } from "@/lib/layout";

export default function TorneiosPage() {
  return (
    <Suspense
      fallback={
        <main className={appContentClass}>
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
        </main>
      }
    >
      <TournamentsPage />
    </Suspense>
  );
}
