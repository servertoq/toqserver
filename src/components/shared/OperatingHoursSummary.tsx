import type { DayHours } from "@/lib/operatingHours";
import { groupOperatingHours } from "@/lib/operatingHours";

type Props = {
  hours: DayHours[];
  className?: string;
};

export function OperatingHoursSummary({ hours, className = "" }: Props) {
  const groups = groupOperatingHours(hours);

  return (
    <div
      className={`rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)]/70 px-3 py-3 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
        Horários
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {groups.map((row) => (
          <li
            key={`${row.label}-${row.open}-${row.close}-${row.closed}`}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="min-w-[3.25rem] font-semibold text-[var(--toq-navy)]">{row.label}</span>
            <span
              className={
                row.closed
                  ? "rounded-full bg-[var(--toq-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--toq-text-muted)]"
                  : "font-semibold tabular-nums text-[var(--toq-accent)]"
              }
            >
              {row.closed ? "Fechado" : `${row.open} – ${row.close}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
