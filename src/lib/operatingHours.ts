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
