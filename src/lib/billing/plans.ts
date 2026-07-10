import type { UserPlan } from "@/types/plans";

/** Preço mensal em centavos (BRL). */
export const PLAN_PRICES_CENTS: Record<UserPlan, number> = {
  free: 0,
  professor: 2000,
  proprietario: 9900,
  proprietario_plus: 18900,
  empresario: 9900,
};

const PLAN_ORDER: Record<UserPlan, number> = {
  free: 0,
  professor: 1,
  proprietario: 2,
  proprietario_plus: 3,
  empresario: 2,
};

export function normalizePlan(plan: UserPlan | null | undefined): UserPlan {
  if (!plan) return "free";
  if (plan === "empresario") return "proprietario";
  return plan;
}

export function planOrder(plan: UserPlan) {
  return PLAN_ORDER[normalizePlan(plan)];
}

export function isUpgrade(from: UserPlan, to: UserPlan) {
  return planOrder(to) > planOrder(from);
}

export function isDowngrade(from: UserPlan, to: UserPlan) {
  return planOrder(to) < planOrder(from);
}

export function planUpgradeAmountCents(from: UserPlan, to: UserPlan): number {
  if (!isUpgrade(from, to)) return 0;
  const fromNorm = normalizePlan(from);
  const toNorm = normalizePlan(to);
  return PLAN_PRICES_CENTS[toNorm] - PLAN_PRICES_CENTS[fromNorm];
}

export function formatPlanPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function planMonthlyPriceLabel(plan: UserPlan) {
  const cents = PLAN_PRICES_CENTS[normalizePlan(plan)];
  if (cents <= 0) return "Grátis";
  return `${formatPlanPrice(cents)}/mês`;
}

export function planUpgradePriceLabel(from: UserPlan, to: UserPlan) {
  const cents = planUpgradeAmountCents(from, to);
  if (cents <= 0) return null;
  return formatPlanPrice(cents);
}

export const PLAN_FEATURES: Record<
  UserPlan,
  { label: string; included: boolean }[]
> = {
  free: [
    { label: "Feed, mensagens e publicidade", included: true },
    { label: "Ver clubes, quadras e torneios", included: true },
    { label: "Ver anúncios de aulas", included: true },
    { label: "Até 3 comunidades", included: true },
    { label: "Divulgar aulas (Aprenda à Jogar)", included: false },
    { label: "Criar clube ou quadras", included: false },
    { label: "Badge e destaque no feed", included: false },
  ],
  professor: [
    { label: "Tudo do plano Usuário", included: true },
    { label: "Badge Professor no feed", included: true },
    { label: "1 anúncio em Aprenda à Jogar", included: true },
    { label: "Posts em destaque a cada 3 horas", included: true },
    { label: "Criar clube ou quadras", included: false },
  ],
  proprietario: [
    { label: "Tudo do plano Usuário", included: true },
    { label: "Badge Proprietário no feed", included: true },
    { label: "1 clube privado", included: true },
    { label: "Até 4 quadras (clube + aba Quadras)", included: true },
    { label: "Posts em destaque a cada 2 horas", included: true },
    { label: "Anúncio de aulas (professor)", included: false },
  ],
  proprietario_plus: [
    { label: "Tudo do plano Proprietário", included: true },
    { label: "Clubes ilimitados", included: true },
    { label: "Quadras ilimitadas", included: true },
    { label: "Posts em destaque a cada 2 horas", included: true },
  ],
  empresario: [
    { label: "Tudo do plano Usuário", included: true },
    { label: "Badge Proprietário no feed", included: true },
    { label: "1 clube privado", included: true },
    { label: "Até 4 quadras (clube + aba Quadras)", included: true },
    { label: "Posts em destaque a cada 2 horas", included: true },
    { label: "Anúncio de aulas (professor)", included: false },
  ],
};
