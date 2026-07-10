export type DayHours = {
  day: number;
  closed: boolean;
  open: string;
  close: string;
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export type OperatingHoursGroup = {
  label: string;
  closed: boolean;
  open: string;
  close: string;
};

function formatDayRangeShort(days: number[]): string {
  if (days.length === 0) return "";
  if (days.length === 1) return WEEKDAY_SHORT[days[0]!] ?? `Dia ${days[0]}`;
  const first = WEEKDAY_SHORT[days[0]!] ?? String(days[0]);
  const last = WEEKDAY_SHORT[days[days.length - 1]!] ?? String(days[days.length - 1]);
  return `${first}–${last}`;
}

/** Agrupa dias consecutivos com o mesmo horário (ex.: Seg–Sex 08:00–18:00). */
export function groupOperatingHours(hours: DayHours[]): OperatingHoursGroup[] {
  const sorted = [...hours].sort((a, b) => a.day - b.day);
  const groups: Array<{ days: number[]; closed: boolean; open: string; close: string }> = [];

  for (const h of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.closed === h.closed &&
      last.open === h.open &&
      last.close === h.close &&
      last.days[last.days.length - 1] === h.day - 1
    ) {
      last.days.push(h.day);
    } else {
      groups.push({
        days: [h.day],
        closed: h.closed,
        open: h.open,
        close: h.close,
      });
    }
  }

  return groups.map((g) => ({
    label: formatDayRangeShort(g.days),
    closed: g.closed,
    open: g.open,
    close: g.close,
  }));
}

export function defaultOperatingHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: day === 0,
    open: "08:00",
    close: "18:00",
  }));
}

export function parseOperatingHours(raw: unknown): DayHours[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultOperatingHours();

  const byDay = new Map<number, DayHours>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const day = Number(o.day);
    if (day < 0 || day > 6) continue;
    byDay.set(day, {
      day,
      closed: Boolean(o.closed),
      open: typeof o.open === "string" ? o.open : "08:00",
      close: typeof o.close === "string" ? o.close : "18:00",
    });
  }

  return Array.from({ length: 7 }, (_, day) => byDay.get(day) ?? {
    day,
    closed: false,
    open: "08:00",
    close: "18:00",
  });
}

export function operatingHoursToJson(hours: DayHours[]): DayHours[] {
  return hours.map((h) => ({
    day: h.day,
    closed: h.closed,
    open: h.open || "08:00",
    close: h.close || "18:00",
  }));
}

export function formatOperatingHoursSummary(hours: DayHours[]): string[] {
  return hours
    .map((h) => {
      const label = WEEKDAY_LABELS[h.day] ?? `Dia ${h.day}`;
      if (h.closed) return `${label}: fechado`;
      if (h.open && h.close) return `${label}: ${h.open} – ${h.close}`;
      return null;
    })
    .filter((line): line is string => Boolean(line));
}

export function hasOperatingHoursInfo(hours: DayHours[]): boolean {
  return hours.some((h) => !h.closed || h.open || h.close);
}
