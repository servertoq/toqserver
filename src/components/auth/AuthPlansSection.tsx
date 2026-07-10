import { PLAN_FEATURES, planMonthlyPriceLabel } from "@/lib/billing/plans";
import { PLAN_LABELS } from "@/lib/plans";
import type { UserPlan } from "@/types/plans";

const LANDING_PLANS: UserPlan[] = ["free", "professor", "proprietario", "proprietario_plus"];

const PLAN_TAGLINE: Record<UserPlan, string> = {
  free: "Para jogar, socializar e criar até 3 comunidades.",
  professor: "Para quem dá aula — badge e destaque no feed a cada 3h.",
  proprietario: "Para donos de arena — 1 clube, 4 quadras, destaque a cada 2h.",
  proprietario_plus: "Escala total — clubes e quadras ilimitados.",
  empresario: "Para donos de arena.",
};

type Props = {
  onRegister: () => void;
};

export function AuthPlansSection({ onRegister }: Props) {
  return (
    <div className="auth-plans">
      <div className="auth-plans-grid">
        {LANDING_PLANS.map((planId) => {
          const features = PLAN_FEATURES[planId].filter((f) => f.included);
          const isPopular = planId === "professor";

          return (
            <article
              key={planId}
              className={`auth-plan-card auth-plan-card--${planId}${isPopular ? " auth-plan-card--highlight" : ""}`}
            >
              {isPopular && <p className="auth-plan-badge">Mais popular</p>}
              <p className="auth-plan-label">{PLAN_LABELS[planId]}</p>
              <p className="auth-plan-price">{planMonthlyPriceLabel(planId)}</p>
              <p className="auth-plan-tagline">{PLAN_TAGLINE[planId]}</p>
              <ul className="auth-plan-features">
                {features.map((f) => (
                  <li key={f.label}>{f.label}</li>
                ))}
              </ul>
              <button
                type="button"
                className={`auth-plan-cta${planId === "free" ? " auth-plan-cta--secondary" : ""}`}
                onClick={onRegister}
              >
                {planId === "free" ? "Começar grátis" : "Criar conta e assinar"}
              </button>
            </article>
          );
        })}
      </div>
      <p className="auth-plans-footnote">
        Todos começam no plano Usuário. Depois do login, mude de plano quando quiser em{" "}
        <strong>Planos</strong> — no upgrade você paga apenas a diferença mensal.
      </p>
    </div>
  );
}
