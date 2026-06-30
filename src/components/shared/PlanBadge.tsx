import { planBadgeClass, planLabel } from "@/lib/plans";
import type { UserPlan } from "@/types/plans";

type Props = {
  plan: UserPlan;
  show?: boolean;
};

export function PlanBadge({ plan, show = true }: Props) {
  if (!show || plan === "free") return null;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${planBadgeClass(plan)}`}
    >
      {planLabel(plan)}
    </span>
  );
}
