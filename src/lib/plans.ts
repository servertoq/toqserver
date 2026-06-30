import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanInfo, PlanUsage, UserPlan } from "@/types/plans";

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: "Usuário",
  professor: "Professor",
  empresario: "Empresário",
};

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    label: "Usuário",
    priceLabel: null,
    description:
      "Feed, mensagens, clubes, quadras, torneios, anúncios de aulas e publicidade. Até 1 comunidade.",
  },
  {
    id: "professor",
    label: "Professor",
    priceLabel: "R$ 20/mês",
    description:
      "Tudo do usuário + divulgação de 1 aula em Aprenda à Jogar, até 3 comunidades e badge no feed.",
  },
  {
    id: "empresario",
    label: "Empresário",
    priceLabel: "R$ 50/mês",
    description:
      "Tudo do Professor + 1 clube e até 5 quadras no total (clube + aba Quadras). Badge no feed.",
  },
];

export function planLabel(plan: UserPlan | null | undefined) {
  if (!plan) return PLAN_LABELS.free;
  return PLAN_LABELS[plan] ?? plan;
}

export function hasPaidPlan(plan: UserPlan | null | undefined) {
  return plan === "professor" || plan === "empresario";
}

export function canShowPlanBadge(
  plan: UserPlan | null | undefined,
  showPlanBadge: boolean | null | undefined
) {
  return hasPaidPlan(plan) && showPlanBadge !== false;
}

export function planBadgeClass(plan: UserPlan) {
  if (plan === "professor") {
    return "bg-emerald-100 text-emerald-800";
  }
  return "bg-violet-100 text-violet-800";
}

export async function fetchPlanUsage(supabase: SupabaseClient): Promise<PlanUsage | null> {
  const { data, error } = await supabase.rpc("get_my_plan_usage");
  if (error || !data) return null;
  return data as PlanUsage;
}

export function planLimitMessage(usage: PlanUsage, resource: "community" | "club" | "coach" | "court") {
  switch (resource) {
    case "community":
      return `Seu plano (${planLabel(usage.plan)}) permite até ${usage.communities_max} comunidade(s). Você já criou ${usage.communities_count}.`;
    case "club":
      if (usage.plan !== "empresario") {
        return "Apenas o plano Empresário pode criar clubes.";
      }
      return "Limite de 1 clube atingido no plano Empresário.";
    case "coach":
      if (!hasPaidPlan(usage.plan)) {
        return "Apenas planos Professor ou Empresário podem divulgar aulas em Aprenda à Jogar.";
      }
      return "Você já possui uma divulgação de aulas.";
    case "court":
      if (usage.plan !== "empresario") {
        return "Apenas o plano Empresário pode cadastrar quadras.";
      }
      return `Limite de ${usage.courts_max} quadras atingido (${usage.courts_count} cadastradas).`;
  }
}
