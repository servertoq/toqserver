import type { UserPlan } from "@/types/plans";

/** Preço mensal em centavos (BRL). */
export const PLAN_PRICES_CENTS: Record<UserPlan, number> = {
  free: 0,
  professor: 2000,
  empresario: 5000,
};

const PLAN_ORDER: Record<UserPlan, number> = {
  free: 0,
  professor: 1,
  empresario: 2,
};

export function planOrder(plan: UserPlan) {
  return PLAN_ORDER[plan];
}

export function isUpgrade(from: UserPlan, to: UserPlan) {
  return planOrder(to) > planOrder(from);
}

export function isDowngrade(from: UserPlan, to: UserPlan) {
  return planOrder(to) < planOrder(from);
}

/** Valor a pagar ao mudar de plano (diferença mensal). */
export function planUpgradeAmountCents(from: UserPlan, to: UserPlan): number {
  if (!isUpgrade(from, to)) return 0;
  return PLAN_PRICES_CENTS[to] - PLAN_PRICES_CENTS[from];
}

export function formatPlanPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function planMonthlyPriceLabel(plan: UserPlan) {
  const cents = PLAN_PRICES_CENTS[plan];
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
    { label: "Até 1 comunidade", included: true },
    { label: "Divulgar aulas (Aprenda à Jogar)", included: false },
    { label: "Criar clube ou quadras", included: false },
    { label: "Badge no feed", included: false },
  ],
  professor: [
    { label: "Tudo do plano Usuário", included: true },
    { label: "1 anúncio em Aprenda à Jogar", included: true },
    { label: "Até 3 comunidades", included: true },
    { label: "Badge Professor no feed", included: true },
    { label: "Criar clube", included: false },
    { label: "Cadastrar quadras", included: false },
  ],
  empresario: [
    { label: "Tudo do plano Professor", included: true },
    { label: "1 clube privado", included: true },
    { label: "Até 5 quadras (clube + aba Quadras)", included: true },
    { label: "Badge Empresário no feed", included: true },
  ],
};
