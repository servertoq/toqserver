import type { UserPlan } from "@/types/plans";

/** Preço mensal em centavos (BRL). */
export const PLAN_PRICES_CENTS: Record<UserPlan, number> = {
  free: 0,
  professor: 2000,
  promotor: 5000,
  proprietario: 9900,
  proprietario_plus: 18900,
  empresario: 9900,
};

/** Dias de validade de cada ciclo pago. */
export const PLAN_CYCLE_DAYS = 30;
/** Janela em que o upgrade cobra só a diferença. */
export const PLAN_UPGRADE_DIFF_DAYS = 15;
/** Lembrete de renovação (Pix / avulso) antes do vencimento. */
export const PLAN_RENEWAL_REMINDER_DAYS = 3;

export type PlanPaymentMode = "pix" | "card_once" | "card_recurring";
export type PlanChargeKind = "new" | "renew" | "upgrade_diff" | "upgrade_full";

const PLAN_ORDER: Record<UserPlan, number> = {
  free: 0,
  professor: 1,
  promotor: 2,
  proprietario: 3,
  proprietario_plus: 4,
  empresario: 3,
};

const DAY_MS = 24 * 60 * 60 * 1000;

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

export function isPaidPlan(plan: UserPlan | null | undefined) {
  return normalizePlan(plan) !== "free";
}

/** Upgrade dentro de 15 dias desde plan_activated_at → só diferença. */
export function isWithinUpgradeDiffWindow(
  activatedAt: string | Date | null | undefined,
  now = new Date()
) {
  if (!activatedAt) return false;
  const start = typeof activatedAt === "string" ? new Date(activatedAt) : activatedAt;
  if (Number.isNaN(start.getTime())) return false;
  return now.getTime() - start.getTime() < PLAN_UPGRADE_DIFF_DAYS * DAY_MS;
}

export type PlanChargeQuote = {
  amountCents: number;
  chargeKind: PlanChargeKind;
  /** Texto curto para o checkout. */
  description: string;
};

/**
 * Calcula o valor a cobrar.
 * - free → plano pago: valor integral (new)
 * - mesmo plano (renovar): valor integral (renew)
 * - upgrade ≤15 dias: diferença (upgrade_diff)
 * - upgrade >15 dias: valor integral do destino (upgrade_full)
 */
export function quotePlanCharge(
  from: UserPlan,
  to: UserPlan,
  activatedAt?: string | Date | null,
  now = new Date()
): PlanChargeQuote {
  const fromNorm = normalizePlan(from);
  const toNorm = normalizePlan(to);

  if (toNorm === "free") {
    return { amountCents: 0, chargeKind: "new", description: "Sem cobrança" };
  }

  const full = PLAN_PRICES_CENTS[toNorm];

  if (fromNorm === "free" || !isPaidPlan(fromNorm)) {
    return {
      amountCents: full,
      chargeKind: "new",
      description: `Assinatura ${toNorm} — 30 dias`,
    };
  }

  if (fromNorm === toNorm) {
    return {
      amountCents: full,
      chargeKind: "renew",
      description: `Renovação ${toNorm} — +30 dias`,
    };
  }

  if (isUpgrade(fromNorm, toNorm)) {
    if (isWithinUpgradeDiffWindow(activatedAt, now)) {
      const diff = full - PLAN_PRICES_CENTS[fromNorm];
      return {
        amountCents: Math.max(diff, 0),
        chargeKind: "upgrade_diff",
        description: `Upgrade ${fromNorm} → ${toNorm} (diferença, ciclo atual)`,
      };
    }
    return {
      amountCents: full,
      chargeKind: "upgrade_full",
      description: `Upgrade ${fromNorm} → ${toNorm} — 30 dias`,
    };
  }

  return { amountCents: 0, chargeKind: "new", description: "Sem cobrança" };
}

/** @deprecated use quotePlanCharge — mantido para compat. */
export function planUpgradeAmountCents(from: UserPlan, to: UserPlan): number {
  return quotePlanCharge(from, to, null).amountCents;
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

export function planUpgradePriceLabel(
  from: UserPlan,
  to: UserPlan,
  activatedAt?: string | Date | null
) {
  const quote = quotePlanCharge(from, to, activatedAt);
  if (quote.amountCents <= 0) return null;
  return formatPlanPrice(quote.amountCents);
}

export function formatPlanExpiry(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
    { label: "Criar torneios avulsos", included: false },
    { label: "Criar clube ou quadras", included: false },
    { label: "Badge e destaque no feed", included: false },
  ],
  professor: [
    { label: "Tudo do plano Usuário", included: true },
    { label: "Badge Professor no feed", included: true },
    { label: "1 anúncio em Aprenda à Jogar", included: true },
    { label: "Posts em destaque a cada 3 horas", included: true },
    { label: "Criar torneios avulsos", included: false },
    { label: "Criar clube ou quadras", included: false },
  ],
  promotor: [
    { label: "Tudo do plano Usuário", included: true },
    { label: "Badge Promotor no feed", included: true },
    { label: "Criar e gerenciar torneios avulsos", included: true },
    { label: "Painel Gestão de Torneios", included: true },
    { label: "Posts em destaque a cada 4 horas", included: true },
    { label: "Criar clube ou divulgar aulas", included: false },
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
