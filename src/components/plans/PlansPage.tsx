"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import {
  formatPlanExpiry,
  formatPlanPrice,
  isDowngrade,
  isUpgrade,
  isWithinUpgradeDiffWindow,
  PLAN_FEATURES,
  planMonthlyPriceLabel,
  planUpgradePriceLabel,
  quotePlanCharge,
  type PlanPaymentMode,
} from "@/lib/billing/plans";
import { fetchPlanUsage, planLabel, normalizePlan } from "@/lib/plans";
import type { PlanUsage } from "@/types/plans";
import type { UserPlan } from "@/types/plans";
import { appContentClass } from "@/lib/layout";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

const PLAN_IDS: UserPlan[] = [
  "free",
  "professor",
  "promotor",
  "proprietario",
  "proprietario_plus",
];

export function PlansPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mpReady, setMpReady] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<UserPlan | null>(null);
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
      .then((d) => setMpReady(Boolean(d?.configured)))
      .catch(() => setMpReady(false));
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
  const activatedAt = usage?.plan_activated_at ?? null;
  const expiresLabel = formatPlanExpiry(usage?.plan_expires_at ?? null);

  async function startCheckout(target: UserPlan, paymentMode: PlanPaymentMode) {
    await guard(async () => {
      setError(null);
      setMessage(null);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan: target, paymentMode }),
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

  function renderAction(target: UserPlan) {
    if (target === currentPlan) {
      const quote = quotePlanCharge(currentPlan, target, activatedAt);
      return (
        <div className="space-y-2">
          <span className="block rounded-xl bg-slate-100 py-2.5 text-center text-sm font-bold text-[var(--toq-navy)]">
            Plano atual
          </span>
          {currentPlan !== "free" && (
            <button
              type="button"
              disabled={processing || !mpReady}
              onClick={() => setCheckoutTarget(target)}
              className="w-full rounded-xl border border-[var(--toq-accent)] py-2 text-sm font-semibold text-[var(--toq-accent)] disabled:opacity-50"
            >
              Renovar — {formatPlanPrice(quote.amountCents)}
            </button>
          )}
        </div>
      );
    }

    if (isUpgrade(currentPlan, target) || (currentPlan === "free" && target !== "free")) {
      const diff = planUpgradePriceLabel(currentPlan, target, activatedAt);
      const within15 = isWithinUpgradeDiffWindow(activatedAt);
      return (
        <button
          type="button"
          disabled={processing || !mpReady}
          onClick={() => setCheckoutTarget(target)}
          className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {diff
            ? within15 && currentPlan !== "free"
              ? `Upgrade — pagar ${diff}`
              : `Assinar — ${diff}`
            : "Assinar"}
        </button>
      );
    }

    if (isDowngrade(currentPlan, target)) {
      return (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xs leading-snug text-[var(--toq-text-muted)]">
          {target === "free"
            ? "Você volta para Usuário automaticamente se não renovar após o vencimento."
            : "Não é possível reduzir o plano no meio do ciclo. Ao vencer sem renovar, a conta volta para Usuário."}
        </p>
      );
    }

    return null;
  }

  const checkoutQuote = checkoutTarget
    ? quotePlanCharge(currentPlan, checkoutTarget, activatedAt)
    : null;

  return (
    <>
      <main className={appContentClass}>
        <PageHeader
          kicker=""
          title="Planos"
          subtitle="Cada plano vale 30 dias. Pix é renovação manual (avisamos 3 dias antes). Cartão pode ser recorrente. Upgrade nos primeiros 15 dias cobra só a diferença. Não dá para reduzir o plano no meio do ciclo — sem renovação, volta para Usuário."
        />

        {currentPlan !== "free" && expiresLabel && (
          <p className="mb-4 rounded-lg bg-sky-500/10 px-3 py-2 text-sm text-sky-900">
            Seu plano <strong>{planLabel(currentPlan)}</strong>{" "}
            {usage?.plan_active === false ? (
              <>expirou em {expiresLabel} — renove para reativar.</>
            ) : (
              <>
                vale até <strong>{expiresLabel}</strong>
                {usage?.plan_billing_mode === "card_recurring"
                  ? " (renovação automática no cartão)."
                  : " — renove via Pix ou cartão antes do vencimento."}
              </>
            )}
          </p>
        )}

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

        {!mpReady && !loading && (
          <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
            Pagamentos (Mercado Pago) ainda não estão configurados no servidor.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando planos…</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {PLAN_IDS.map((planId) => {
              const isCurrent = planId === currentPlan;
              const features = PLAN_FEATURES[planId];
              const upgradeHint =
                isUpgrade(currentPlan, planId) && planUpgradePriceLabel(currentPlan, planId, activatedAt);

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
                  {upgradeHint && (
                    <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
                      Você paga agora: <strong>{upgradeHint}</strong>
                      {isWithinUpgradeDiffWindow(activatedAt) && currentPlan !== "free"
                        ? " (diferença — até 15 dias do ciclo)"
                        : " (ciclo de 30 dias)"}
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
          Preços / 30 dias: Usuário grátis · Professor {formatPlanPrice(2000)} · Promotor{" "}
          {formatPlanPrice(5000)} · Proprietário {formatPlanPrice(9900)} · Proprietário Plus{" "}
          {formatPlanPrice(18900)}. Pagamentos via Mercado Pago (Pix e cartão). Sem renovação, as
          funções do plano são desligadas automaticamente.
        </p>
      </main>

      {checkoutTarget && checkoutQuote && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="checkout-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="checkout-title" className="text-lg font-bold text-[var(--toq-navy)]">
              {currentPlan === checkoutTarget ? "Renovar" : "Assinar"} {planLabel(checkoutTarget)}
            </h3>
            <p className="mt-2 text-sm text-[var(--toq-text-muted)]">
              {checkoutQuote.description}. Valor agora:{" "}
              <strong className="text-[var(--toq-navy)]">
                {formatPlanPrice(checkoutQuote.amountCents)}
              </strong>
              .
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={processing}
                onClick={() => void startCheckout(checkoutTarget, "pix")}
                className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {processing ? "Redirecionando…" : "Pagar com Pix"}
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => void startCheckout(checkoutTarget, "card_once")}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[var(--toq-navy)] disabled:opacity-50"
              >
                Cartão (só este ciclo de 30 dias)
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => void startCheckout(checkoutTarget, "card_recurring")}
                className="w-full rounded-xl border border-[var(--toq-accent)] py-2.5 text-sm font-semibold text-[var(--toq-accent)] disabled:opacity-50"
              >
                Cartão com renovação automática
              </button>
            </div>
            <button
              type="button"
              className="mt-3 w-full py-2 text-sm text-[var(--toq-text-muted)]"
              onClick={() => setCheckoutTarget(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
