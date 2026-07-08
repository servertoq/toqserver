"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AGENDA_EVENT_TYPES,
  AGENDA_NOTES_MAX,
  AGENDA_TITLE_MAX,
  formatAgendaDateLong,
} from "@/lib/agenda";
import type { AgendaEvent, AgendaEventType } from "@/types/agenda";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

export type AgendaEventFormValues = {
  event_type: AgendaEventType;
  title: string;
  notes: string;
  event_time: string;
};

type Props = {
  open: boolean;
  dateISO: string;
  initial?: AgendaEvent | null;
  onClose: () => void;
  onSave: (values: AgendaEventFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function AgendaEventForm({ open, dateISO, initial, onClose, onSave, onDelete }: Props) {
  const [mounted, setMounted] = useState(false);
  const [eventType, setEventType] = useState<AgendaEventType>("treino");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, guard } = useSingleSubmit();
  const isEdit = Boolean(initial);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setEventType(initial?.event_type ?? "treino");
    setTitle(initial?.title ?? "");
    setNotes(initial?.notes ?? "");
    setEventTime(initial?.event_time?.slice(0, 5) ?? "");
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isSubmitting, onClose]);

  if (!open || !mounted) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    await guard(async () => {
      try {
        await onSave({
          event_type: eventType,
          title: title.trim(),
          notes: notes.trim(),
          event_time: eventTime,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("Excluir este compromisso?")) return;
    setError(null);
    await guard(async () => {
      try {
        await onDelete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível excluir.");
      }
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-event-form-title"
        className="flex max-h-[min(92dvh,calc(100dvh-1rem))] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-[0_16px_48px_rgba(5,16,36,0.14)] sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--toq-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="agenda-event-form-title" className="text-base font-bold text-[var(--toq-navy)]">
              {isEdit ? "Editar compromisso" : "Novo compromisso"}
            </h2>
            <p className="mt-0.5 text-xs capitalize text-[var(--toq-text-muted)]">
              {formatAgendaDateLong(dateISO)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="shrink-0 text-sm font-semibold text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)] disabled:opacity-50"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <fieldset>
            <legend className="text-xs font-semibold text-[var(--toq-navy)]">Tipo</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {AGENDA_EVENT_TYPES.map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    eventType === opt.value
                      ? "border-[var(--toq-accent)] bg-[var(--toq-accent-soft)] text-[var(--toq-navy)]"
                      : "border-[var(--toq-border)] text-[var(--toq-text-muted)] hover:border-[var(--toq-accent)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="agenda-event-type"
                    className="sr-only"
                    checked={eventType === opt.value}
                    onChange={() => setEventType(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome (opcional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, AGENDA_TITLE_MAX))}
              maxLength={AGENDA_TITLE_MAX}
              placeholder="Ex.: Treino de saque"
              className="mt-1 w-full rounded-xl toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Horário (opcional)</span>
            <input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              className="mt-1 w-full rounded-xl toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Observação (opcional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, AGENDA_NOTES_MAX))}
              maxLength={AGENDA_NOTES_MAX}
              rows={3}
              placeholder="Local, material, lembrete…"
              className="mt-1 w-full resize-y rounded-xl toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
            />
            <span className="mt-1 block text-right text-[10px] text-[var(--toq-text-muted)]">
              {notes.length}/{AGENDA_NOTES_MAX}
            </span>
          </label>

          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--toq-border)] px-5 py-4">
          {isEdit && onDelete ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isSubmitting}
              className="text-xs font-semibold text-red-600 disabled:opacity-50"
            >
              Excluir
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg toq-btn-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Salvando…" : isEdit ? "Salvar" : "Agendar"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
