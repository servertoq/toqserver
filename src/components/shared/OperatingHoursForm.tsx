"use client";

import type { DayHours } from "@/lib/operatingHours";
import { WEEKDAY_LABELS } from "@/lib/operatingHours";

type Props = {
  value: DayHours[];
  onChange: (next: DayHours[]) => void;
};

export function OperatingHoursForm({ value, onChange }: Props) {
  function updateDay(day: number, patch: Partial<DayHours>) {
    onChange(value.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  }

  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <legend className="px-1 text-xs font-semibold text-[var(--toq-navy)]">
        Horário de funcionamento
      </legend>
      <p className="text-[10px] text-[var(--toq-text-muted)]">
        Informe os horários de cada dia. Marque &quot;Fechado&quot; quando não houver atendimento.
      </p>

      <ul className="mt-2 space-y-2">
        {value.map((row) => (
          <li
            key={row.day}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2"
          >
            <span className="w-28 shrink-0 text-xs font-semibold text-[var(--toq-navy)] sm:w-32">
              {WEEKDAY_LABELS[row.day]}
            </span>
            <label className="flex items-center gap-1.5 text-xs text-[var(--toq-navy)]">
              <input
                type="checkbox"
                checked={row.closed}
                onChange={(e) => updateDay(row.day, { closed: e.target.checked })}
              />
              Fechado
            </label>
            {!row.closed && (
              <>
                <input
                  type="time"
                  value={row.open}
                  onChange={(e) => updateDay(row.day, { open: e.target.value })}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-[var(--toq-navy)]"
                />
                <span className="text-xs text-[var(--toq-text-muted)]">até</span>
                <input
                  type="time"
                  value={row.close}
                  onChange={(e) => updateDay(row.day, { close: e.target.value })}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-[var(--toq-navy)]"
                />
              </>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
