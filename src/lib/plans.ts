import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlan, PLAN_FEATURES as BILLING_FEATURES } from "@/lib/billing/plans";
import { canModeratePlatform } from "@/lib/staff";
import type { PlanInfo, PlanUsage, UserPlan } from "@/types/plans";
import type { StaffRole } from "@/types/staff";

export { normalizePlan } from "@/lib/billing/plans";

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: "Usuário",
  professor: "Professor",
  proprietario: "Proprietário",
  proprietario_plus: "Proprietário Plus",
  empresario: "Proprietário",
};

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    label: "Usuário",
    priceLabel: null,
    description: "Feed, mensagens, clubes, quadras, torneios e até 3 comunidades.",
  },
  {
    id: "professor",
    label: "Professor",
    priceLabel: "R$ 20/mês",
    description:
      "Badge de professor, 1 anúncio de aulas e posts em destaque no feed a cada 3 horas.",
  },
  {
    id: "proprietario",
    label: "Proprietário",
    priceLabel: "R$ 99/mês",
    description:
      "1 clube, até 4 quadras, badge de proprietário e destaque no feed a cada 2 horas.",
  },
  {
    id: "proprietario_plus",
    label: "Proprietário Plus",
    priceLabel: "R$ 189/mês",
    description: "Clubes e quadras ilimitados, com todos os benefícios do Proprietário.",
  },
];

export { BILLING_FEATURES as PLAN_FEATURES };

export function planLabel(plan: UserPlan | null | undefined) {
  const normalized = normalizePlan(plan ?? "free");
  return PLAN_LABELS[normalized] ?? normalized;
}

export function isProfessorPlan(plan: UserPlan | null | undefined) {
  return normalizePlan(plan ?? "free") === "professor";
}

export function isProprietarioPlan(plan: UserPlan | null | undefined) {
  const p = normalizePlan(plan ?? "free");
  return p === "proprietario" || p === "proprietario_plus";
}

export function hasPaidPlan(plan: UserPlan | null | undefined) {
  return isProfessorPlan(plan) || isProprietarioPlan(plan);
}

/** CEO, CTO e Moderador ignoram limites de plano na plataforma. */
export function hasStaffUnlimitedAccess(staffRole: StaffRole | null | undefined) {
  return canModeratePlatform(staffRole ?? null);
}

export function canCreateCommunityResource(
  usage: PlanUsage | null | undefined,
  staffRole: StaffRole | null | undefined,
  kind: "community" | "club"
) {
  if (hasStaffUnlimitedAccess(staffRole)) return true;
  if (kind === "club") return usage?.can_create_club ?? false;
  return usage?.can_create_community ?? true;
}

export function canCreateCourtResource(
  usage: PlanUsage | null | undefined,
  staffRole: StaffRole | null | undefined
) {
  return hasStaffUnlimitedAccess(staffRole) || (usage?.can_create_court ?? false);
}

export function canCreateCoachListingResource(
  usage: PlanUsage | null | undefined,
  staffRole: StaffRole | null | undefined,
  hasExistingListing: boolean
) {
  if (hasExistingListing) return true;
  return (
    hasStaffUnlimitedAccess(staffRole) ||
    (usage?.can_create_coach_listing ?? false) ||
    isProfessorPlan(usage?.plan)
  );
}

export function canShowPlanBadge(
  plan: UserPlan | null | undefined,
  showPlanBadge: boolean | null | undefined
) {
  return hasPaidPlan(plan) && showPlanBadge !== false;
}

export function planBadgeClass(plan: UserPlan) {
  const p = normalizePlan(plan);
  if (p === "professor") return "bg-emerald-100 text-emerald-800";
  if (p === "proprietario_plus") return "bg-amber-100 text-amber-900";
  return "bg-violet-100 text-violet-800";
}

export function planHasFeedBoost(plan: UserPlan | null | undefined) {
  return isProfessorPlan(plan) || isProprietarioPlan(plan);
}

export function feedBoostIntervalHours(plan: UserPlan | null | undefined): number | null {
  const p = normalizePlan(plan ?? "free");
  if (p === "professor") return 3;
  if (p === "proprietario" || p === "proprietario_plus") return 2;
  return null;
}

export async function fetchPlanUsage(supabase: SupabaseClient): Promise<PlanUsage | null> {
  const { data, error } = await supabase.rpc("get_my_plan_usage");
  if (error || !data) return null;
  const usage = data as PlanUsage;
  return { ...usage, plan: normalizePlan(usage.plan) };
}

export function formatLimitMax(max: number | null | undefined, unlimitedLabel = "Ilimitado") {
  if (max === null || max === undefined) return unlimitedLabel;
  return String(max);
}

export function planLimitMessage(usage: PlanUsage, resource: "community" | "club" | "coach" | "court") {
  const plan = normalizePlan(usage.plan);
  switch (resource) {
    case "community":
      return `Seu plano (${planLabel(plan)}) permite até ${usage.communities_max} comunidade(s). Você já criou ${usage.communities_count}.`;
    case "club":
      if (!isProprietarioPlan(plan)) {
        return "Apenas planos Proprietário podem criar clubes.";
      }
      if (usage.clubs_max === null) return "Limite de clubes atingido.";
      return `Limite de ${usage.clubs_max} clube(s) atingido no plano Proprietário.`;
    case "coach":
      if (!isProfessorPlan(plan)) {
        return "Apenas o plano Professor pode divulgar aulas em Aprenda à Jogar.";
      }
      return "Você já possui uma divulgação de aulas.";
    case "court":
      if (!isProprietarioPlan(plan)) {
        return "Apenas planos Proprietário podem cadastrar quadras.";
      }
      if (usage.courts_max === null) return "Limite de quadras atingido.";
      return `Limite de ${usage.courts_max} quadras atingido (${usage.courts_count} cadastradas).`;
  }
}
