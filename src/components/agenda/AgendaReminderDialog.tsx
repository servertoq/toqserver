"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  agendaEventDisplayTitle,
  agendaEventTypeLabel,
  formatAgendaTime,
  markAgendaReminderSeen,
  relativeAgendaDayLabel,
  sortAgendaEvents,
  toLocalDateISO,
} from "@/lib/agenda";
import type { AgendaEvent } from "@/types/agenda";

type Props = {
  open: boolean;
  userId: string;
  events: AgendaEvent[];
  onClose: () => void;
};

export function AgendaReminderDialog({ open, userId, events, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const todayISO = toLocalDateISO();
  const sorted = sortAgendaEvents(events);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        markAgendaReminderSeen(userId, todayISO);
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, userId, todayISO, onClose]);

  function handleClose() {
    markAgendaReminderSeen(userId, todayISO);
    onClose();
  }

  if (!open || !mounted || sorted.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-reminder-title"
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-[0_20px_60px_rgba(5,16,36,0.28)] sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--toq-accent)] to-[#1d4ed8] px-5 pb-6 pt-5 text-white">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-white/10"
            aria-hidden
          />
          <p className="relative text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
            Agenda
          </p>
          <h2 id="agenda-reminder-title" className="relative mt-1 text-xl font-bold">
            Você tem compromisso{sorted.length > 1 ? "s" : ""} chegando
          </h2>
          <p className="relative mt-1 text-sm text-white/85">
            Lembrete para hoje e amanhã — prepare o material e a quadra.
          </p>
        </div>

        <ul className="max-h-[min(40vh,16rem)] space-y-2 overflow-y-auto px-5 py-4">
          {sorted.map((event) => {
            const time = formatAgendaTime(event.event_time);
            return (
              <li
                key={event.id}
                className="rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-surface)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--toq-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--toq-accent)]">
                    {relativeAgendaDayLabel(event.event_date, todayISO)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
                    {agendaEventTypeLabel(event.event_type)}
                  </span>
                  {time && (
                    <span className="text-xs font-semibold text-[var(--toq-navy)]">{time}</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm font-bold text-[var(--toq-navy)]">
                  {agendaEventDisplayTitle(event)}
                </p>
                {event.notes && (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--toq-text-muted)]">
                    {event.notes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--toq-border)] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl toq-btn-outline px-4 py-2.5 text-sm font-semibold"
          >
            Fechar
          </button>
          <Link
            href="/inicio/perfil?tab=agenda"
            onClick={handleClose}
            className="rounded-xl toq-btn-primary px-4 py-2.5 text-center text-sm font-bold text-white"
          >
            Ver agenda
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
