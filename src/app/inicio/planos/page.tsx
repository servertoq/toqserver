import { Suspense } from "react";
import { PlansPage } from "@/components/plans/PlansPage";

export default function PlanosPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--toq-text-muted)]">Carregando…</p>}>
      <PlansPage />
    </Suspense>
  );
}
