"use client";

import Link from "next/link";
import { PLANS, planLabel } from "@/lib/plans";
import { planMonthlyPriceLabel } from "@/lib/billing/plans";
import type { UserPlan } from "@/types/plans";

type Props = {
  plan: UserPlan;
  showPlanBadge: boolean;
  onToggleBadge: (value: boolean) => void;
  saving?: boolean;
};

export function ProfilePlanSection({ plan, showPlanBadge, onToggleBadge, saving }: Props) {
  const info = PLANS.find((p) => p.id === plan) ?? PLANS[0];
  const canToggle =
    plan === "professor" || plan === "proprietario" || plan === "proprietario_plus";

  return (
    <div className="rounded-2xl border border-[var(--toq-profile-border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="profile-section-label">Seu plano</p>
        <Link
          href="/inicio/planos"
          className="text-xs font-bold text-[var(--toq-profile-accent)] hover:underline"
        >
          Ver planos e mudar →
        </Link>
      </div>
      <p className="mt-2 text-base font-bold text-[var(--toq-profile-navy)]">{info.label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--toq-profile-accent)]">
        {planMonthlyPriceLabel(plan)}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--toq-profile-muted)]">
        {info.description}
      </p>

      {canToggle && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--toq-profile-border)] px-3 py-3">
          <input
            type="checkbox"
            checked={showPlanBadge}
            disabled={saving}
            onChange={(e) => onToggleBadge(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-semibold text-[var(--toq-profile-navy)]">
              Exibir badge {planLabel(plan)} no feed
            </span>
            <span className="mt-0.5 block text-xs text-[var(--toq-profile-muted)]">
              Quando você publicar, outros usuários verão seu selo de {planLabel(plan).toLowerCase()}.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
