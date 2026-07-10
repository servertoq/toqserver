"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import {
  formatPlanPrice,
  isDowngrade,
  isUpgrade,
  PLAN_FEATURES,
  planMonthlyPriceLabel,
  planUpgradePriceLabel,
} from "@/lib/billing/plans";
import { fetchPlanUsage, planLabel, normalizePlan } from "@/lib/plans";
import type { PlanUsage } from "@/types/plans";
import type { UserPlan } from "@/types/plans";
import { appContentClass } from "@/lib/layout";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

const PLAN_IDS: UserPlan[] = ["free", "professor", "proprietario", "proprietario_plus"];

export function PlansPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const { isSubmitting: processing, guard } = useSingleSubmit();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchPlanUsage(supabase);
    setUsage(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((d) => setStripeReady(Boolean(d?.configured)))
      .catch(() => setStripeReady(false));
  }, []);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setMessage("Pagamento recebido! Seu plano será atualizado em instantes.");
      router.replace("/inicio/planos");
      void load();
    } else if (searchParams.get("cancelled") === "1") {
      setMessage("Checkout cancelado. Nenhuma cobrança foi feita.");
      router.replace("/inicio/planos");
    }
  }, [searchParams, router, load]);

  const currentPlan = normalizePlan(usage?.plan ?? profile.plan);

  async function handleUpgrade(target: UserPlan) {
    await guard(async () => {
      setError(null);
      setMessage(null);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan: target }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Não foi possível iniciar o pagamento.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    });
  }

  async function handleDowngrade(target: UserPlan) {
    await guard(async () => {
      setError(null);
      setMessage(null);

      const { error: rpcErr } = await supabase.rpc("downgrade_user_plan", {
        p_target: target,
      });

      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }

      setMessage(`Plano alterado para ${planLabel(target)}.`);
      await load();
      router.refresh();
    });
  }

  function renderAction(target: UserPlan) {
    if (target === currentPlan) {
      return (
        <span className="block rounded-xl bg-slate-100 py-2.5 text-center text-sm font-bold text-[var(--toq-navy)]">
          Plano atual
        </span>
      );
    }

    if (isUpgrade(currentPlan, target)) {
      const diff = planUpgradePriceLabel(currentPlan, target);
      return (
        <button
          type="button"
          disabled={processing || !stripeReady}
          onClick={() => handleUpgrade(target)}
          className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {processing
            ? "Redirecionando…"
            : diff
              ? `Assinar — pagar ${diff}`
              : "Fazer upgrade"}
        </button>
      );
    }

    if (isDowngrade(currentPlan, target)) {
      return (
        <button
          type="button"
          disabled={processing}
          onClick={() => handleDowngrade(target)}
          className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[var(--toq-navy)] hover:border-[var(--toq-accent)] disabled:opacity-50"
        >
          {processing ? "Alterando…" : "Mudar para este plano"}
        </button>
      );
    }

    return null;
  }

  return (
    <>
      <main className={appContentClass}>
        <PageHeader
          kicker=""
          title="Planos"
          subtitle="Escolha o plano ideal. Upgrades cobram apenas a diferença mensal; downgrades são imediatos quando permitido."
        />

        {message && (
          <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando planos…</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {PLAN_IDS.map((planId) => {
              const isCurrent = planId === currentPlan;
              const features = PLAN_FEATURES[planId];

              return (
                <article
                  key={planId}
                  className={`flex flex-col rounded-2xl border p-5 shadow-sm ${
                    isCurrent
                      ? "border-[var(--toq-accent)] bg-[var(--toq-accent-soft)]/30 ring-2 ring-[var(--toq-accent)]/20"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
                    {isCurrent ? "Seu plano" : "Plano"}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[var(--toq-navy)]">
                    {planLabel(planId)}
                  </h2>
                  <p className="mt-2 text-2xl font-bold text-[var(--toq-accent)]">
                    {planMonthlyPriceLabel(planId)}
                  </p>
                  {isUpgrade(currentPlan, planId) && planUpgradePriceLabel(currentPlan, planId) && (
                    <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
                      Você paga agora:{" "}
                      <strong>{planUpgradePriceLabel(currentPlan, planId)}</strong> (diferença)
                    </p>
                  )}

                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {features.map((f) => (
                      <li
                        key={f.label}
                        className={`flex gap-2 ${f.included ? "text-[var(--toq-navy)]" : "text-[var(--toq-text-muted)] line-through"}`}
                      >
                        <span aria-hidden>{f.included ? "✓" : "—"}</span>
                        {f.label}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5">{renderAction(planId)}</div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-[var(--toq-text-muted)]">
          Preços mensais: Usuário grátis · Professor {formatPlanPrice(2000)} · Proprietário{" "}
          {formatPlanPrice(9900)} · Proprietário Plus {formatPlanPrice(18900)}. No upgrade você paga
          a diferença. Para reduzir o plano, remova conteúdo que exceda os limites do plano inferior.
        </p>
      </main>
    </>
  );
}
