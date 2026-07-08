"use client";

import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  formatAgendaMonthYear,
  toLocalDateISO,
} from "@/lib/agenda";

type Props = {
  year: number;
  monthIndex: number;
  selectedDate: string;
  markedDates: Set<string>;
  onSelectDate: (dateISO: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  embedded?: boolean;
};

export function AgendaCalendar({
  year,
  monthIndex,
  selectedDate,
  markedDates,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  embedded = false,
}: Props) {
  const todayISO = toLocalDateISO();
  const cells = buildMonthGrid(year, monthIndex);
  const title = formatAgendaMonthYear(year, monthIndex);

  const cellHeightClass = embedded ? "h-11 sm:h-12" : "h-9 sm:h-10";

  return (
    <section
      className={`toq-card-lg p-3 sm:p-4 lg:p-5 ${embedded ? "flex h-full min-h-[28rem] flex-col" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--toq-border)] text-[var(--toq-navy)] transition hover:bg-[var(--toq-surface)] sm:h-10 sm:w-10"
          aria-label="Mês anterior"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-base font-bold capitalize text-[var(--toq-navy)] sm:text-lg">{title}</h2>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--toq-border)] text-[var(--toq-navy)] transition hover:bg-[var(--toq-surface)] sm:h-10 sm:w-10"
          aria-label="Próximo mês"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className={`grid grid-cols-7 gap-1 text-center sm:gap-1.5 ${embedded ? "flex-1" : ""}`}>
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)] sm:pb-2 sm:text-xs"
          >
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell.dateISO || cell.day === null) {
            return <div key={`empty-${index}`} className={cellHeightClass} />;
          }

          const selected = cell.dateISO === selectedDate;
          const isToday = cell.dateISO === todayISO;
          const hasEvents = markedDates.has(cell.dateISO);

          return (
            <button
              key={cell.dateISO}
              type="button"
              onClick={() => onSelectDate(cell.dateISO!)}
              className={`relative flex w-full flex-col items-center justify-center rounded-lg text-sm font-semibold transition sm:rounded-xl ${cellHeightClass} ${
                selected
                  ? "bg-[var(--toq-accent)] text-white shadow-sm"
                  : isToday
                    ? "bg-[var(--toq-accent-soft)] text-[var(--toq-navy)]"
                    : "text-[var(--toq-navy)] hover:bg-[var(--toq-surface)]"
              }`}
              aria-pressed={selected}
              aria-label={`${cell.day}${hasEvents ? ", com compromissos" : ""}`}
            >
              {cell.day}
              {hasEvents && (
                <span
                  className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full sm:bottom-2 ${
                    selected ? "bg-white" : "bg-[var(--toq-accent)]"
                  }`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
