import type { AgendaEvent, AgendaEventType } from "@/types/agenda";

export const AGENDA_EVENT_TYPES: { value: AgendaEventType; label: string }[] = [
  { value: "treino", label: "Treino" },
  { value: "aula", label: "Aula" },
  { value: "jogo", label: "Jogo" },
  { value: "outro", label: "Outro" },
];

export const AGENDA_TITLE_MAX = 80;
export const AGENDA_NOTES_MAX = 500;

export function agendaEventTypeLabel(type: AgendaEventType) {
  return AGENDA_EVENT_TYPES.find((t) => t.value === type)?.label ?? "Outro";
}

export function agendaEventDisplayTitle(event: Pick<AgendaEvent, "title" | "event_type">) {
  const trimmed = event.title?.trim();
  if (trimmed) return trimmed;
  return agendaEventTypeLabel(event.event_type);
}

/** YYYY-MM-DD no fuso local */
export function toLocalDateISO(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(dateISO: string, days: number) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toLocalDateISO(date);
}

export function parseLocalDateISO(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatAgendaDateLong(dateISO: string) {
  return parseLocalDateISO(dateISO).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatAgendaTime(time: string | null) {
  if (!time) return null;
  return time.slice(0, 5);
}

export function formatAgendaMonthYear(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function relativeAgendaDayLabel(dateISO: string, todayISO = toLocalDateISO()) {
  if (dateISO === todayISO) return "Hoje";
  if (dateISO === addDaysISO(todayISO, 1)) return "Amanhã";
  return formatAgendaDateLong(dateISO);
}

export type CalendarCell = {
  dateISO: string | null;
  day: number | null;
  inMonth: boolean;
};

/** Grade Seg–Dom do mês (monthIndex 0–11) */
export function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // getDay(): 0=Dom … 6=Sáb → converter para segunda=0
  const startPad = (first.getDay() + 6) % 7;
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({ dateISO: null, day: null, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      dateISO: toLocalDateISO(new Date(year, monthIndex, day)),
      day,
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateISO: null, day: null, inMonth: false });
  }

  return cells;
}

export const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function agendaReminderStorageKey(userId: string, todayISO = toLocalDateISO()) {
  return `toq-agenda-remind-${userId}-${todayISO}`;
}

export function hasSeenAgendaReminderToday(userId: string, todayISO = toLocalDateISO()) {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(agendaReminderStorageKey(userId, todayISO)) === "1";
  } catch {
    return false;
  }
}

export function markAgendaReminderSeen(userId: string, todayISO = toLocalDateISO()) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(agendaReminderStorageKey(userId, todayISO), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function sortAgendaEvents(events: AgendaEvent[]) {
  return [...events].sort((a, b) => {
    if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
    const ta = a.event_time ?? "99:99";
    const tb = b.event_time ?? "99:99";
    return ta.localeCompare(tb);
  });
}
