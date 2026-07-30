import type { ClubCourtPlan } from "@/types/clubFeatures";

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

export type PlanScheduleFields = Pick<
  ClubCourtPlan,
  "applies_weekdays" | "applies_start_time" | "applies_end_time" | "unit_minutes"
>;

function normalizeTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(t) ? t : null;
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

/** Weekday of YYYY-MM-DD in local calendar (0=dom … 6=sáb). */
export function weekdayFromDateISO(dateISO: string): number {
  const d = new Date(`${dateISO}T12:00:00`);
  return Number.isNaN(d.getTime()) ? 0 : d.getDay();
}

export function planAppliesToSlot(
  plan: PlanScheduleFields,
  dateISO: string,
  startHHMM?: string | null
): boolean {
  const weekdays = plan.applies_weekdays;
  if (weekdays != null && weekdays.length > 0) {
    const dow = weekdayFromDateISO(dateISO);
    if (!weekdays.includes(dow)) return false;
  }

  if (plan.unit_minutes >= 1440) return true;

  const start = normalizeTime(startHHMM ?? null);
  if (!start) {
    // Sem horário ainda: válido se o dia bate (faixa de hora verificada depois).
    return true;
  }

  const appliesStart = normalizeTime(plan.applies_start_time);
  const appliesEnd = normalizeTime(plan.applies_end_time);
  const startMin = toMinutes(start);

  if (appliesStart != null && startMin < toMinutes(appliesStart)) return false;
  if (appliesEnd != null && startMin >= toMinutes(appliesEnd)) return false;

  return true;
}

export function planScopeLabel(plan: PlanScheduleFields & { label?: string }): string {
  const parts: string[] = [];

  const days = plan.applies_weekdays;
  if (days == null || days.length === 0 || days.length === 7) {
    parts.push("todos os dias");
  } else {
    const sorted = [...days].sort((a, b) => a - b);
    const isWeekdays =
      sorted.length === 5 && [1, 2, 3, 4, 5].every((d, i) => sorted[i] === d);
    const isWeekend = sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6;
    if (isWeekdays) parts.push("seg–sex");
    else if (isWeekend) parts.push("sáb–dom");
    else parts.push(sorted.map((d) => WEEKDAY_SHORT[d] ?? String(d)).join(", "));
  }

  if (plan.unit_minutes < 1440) {
    const start = normalizeTime(plan.applies_start_time);
    const end = normalizeTime(plan.applies_end_time);
    if (start || end) {
      parts.push(`${start ?? "…"}–${end ?? "…"}`);
    }
  }

  return parts.join(" · ");
}

export function filterPlansForSlot<T extends PlanScheduleFields & { id: string }>(
  plans: T[],
  dateISO: string,
  startHHMM?: string | null
): T[] {
  return plans.filter((p) => planAppliesToSlot(p, dateISO, startHHMM));
}
