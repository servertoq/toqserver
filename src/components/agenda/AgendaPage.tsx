"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { feedPageContainerClass } from "@/lib/layout";
import {
  agendaEventDisplayTitle,
  agendaEventTypeLabel,
  formatAgendaDateLong,
  formatAgendaTime,
  sortAgendaEvents,
  toLocalDateISO,
} from "@/lib/agenda";
import type { AgendaEvent } from "@/types/agenda";
import { AgendaCalendar } from "./AgendaCalendar";
import { AgendaEventForm, type AgendaEventFormValues } from "./AgendaEventForm";

type Props = {
  embedded?: boolean;
};

export function AgendaPage({ embedded = false }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const today = toLocalDateISO();
  const now = new Date();

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);

  const monthRange = useMemo(() => {
    const start = toLocalDateISO(new Date(viewYear, viewMonth, 1));
    const end = toLocalDateISO(new Date(viewYear, viewMonth + 1, 0));
    return { start, end };
  }, [viewYear, viewMonth]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadErr } = await supabase
      .from("user_agenda_events")
      .select("*")
      .eq("user_id", profile.id)
      .gte("event_date", monthRange.start)
      .lte("event_date", monthRange.end)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true });

    if (loadErr) {
      setError(
        loadErr.message.includes("user_agenda_events")
          ? "Não foi possível carregar a agenda. Execute a migration 048_user_agenda_events.sql no Supabase."
          : loadErr.message
      );
      setEvents([]);
    } else {
      setEvents(sortAgendaEvents((data as AgendaEvent[]) ?? []));
    }
    setLoading(false);
  }, [supabase, profile.id, monthRange.start, monthRange.end]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) set.add(event.event_date);
    return set;
  }, [events]);

  const dayEvents = useMemo(
    () => sortAgendaEvents(events.filter((e) => e.event_date === selectedDate)),
    [events, selectedDate]
  );

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(event: AgendaEvent) {
    setEditing(event);
    setFormOpen(true);
  }

  async function handleSave(values: AgendaEventFormValues) {
    const payload = {
      event_type: values.event_type,
      title: values.title || null,
      notes: values.notes || null,
      event_time: values.event_time || null,
      event_date: selectedDate,
    };

    if (editing) {
      const { error: updateErr } = await supabase
        .from("user_agenda_events")
        .update(payload)
        .eq("id", editing.id)
        .eq("user_id", profile.id);
      if (updateErr) throw new Error(updateErr.message);
    } else {
      const { error: insertErr } = await supabase.from("user_agenda_events").insert({
        user_id: profile.id,
        ...payload,
      });
      if (insertErr) throw new Error(insertErr.message);
    }

    setFormOpen(false);
    setEditing(null);
    await loadMonth();
  }

  async function handleDelete() {
    if (!editing) return;
    const { error: deleteErr } = await supabase
      .from("user_agenda_events")
      .delete()
      .eq("id", editing.id)
      .eq("user_id", profile.id);
    if (deleteErr) throw new Error(deleteErr.message);
    setFormOpen(false);
    setEditing(null);
    await loadMonth();
  }

  return (
    <div
      className={
        embedded
          ? "agenda-embedded"
          : `${feedPageContainerClass} agenda-page py-5 md:py-6`
      }
    >
      {embedded ? (
        <div className="mb-4">
          <p className="profile-section-label">Agenda</p>
          <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
            Marque treinos, aulas e jogos. Você recebe um lembrete na tela inicial no dia anterior e no dia.
          </p>
        </div>
      ) : (
        <header className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--toq-text-muted)]">
            Sua programação
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--toq-navy)]">Agenda</h1>
          <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
            Marque treinos, aulas e jogos. Você recebe um lembrete na tela inicial no dia anterior e no dia.
          </p>
        </header>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div
        className={`agenda-page-grid grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] md:gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] ${
          embedded ? "md:items-stretch" : "items-start"
        }`}
      >
        <div className="min-w-0">
          <AgendaCalendar
            embedded={embedded}
            year={viewYear}
            monthIndex={viewMonth}
            selectedDate={selectedDate}
            markedDates={markedDates}
            onSelectDate={setSelectedDate}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
          />
        </div>

        <div
          className={`flex min-w-0 w-full max-w-sm flex-col justify-self-end md:ml-auto ${
            embedded ? "md:h-full" : ""
          }`}
        >
          <section
            className={`toq-card-lg w-full p-4 sm:p-5 ${
              embedded ? "flex h-full min-h-[28rem] flex-col" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold capitalize text-[var(--toq-navy)]">
                  {formatAgendaDateLong(selectedDate)}
                </h2>
                {selectedDate === today && (
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-accent)]">
                    Hoje
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="shrink-0 rounded-lg toq-btn-primary px-4 py-2 text-xs font-bold text-white"
              >
                Agendar
              </button>
            </div>

            {loading ? (
              <p className="mt-4 text-xs text-[var(--toq-text-muted)]">Carregando…</p>
            ) : dayEvents.length === 0 ? (
              <p
                className={`mt-4 rounded-xl border border-dashed border-[var(--toq-border)] px-3 py-6 text-center text-sm text-[var(--toq-text-muted)] ${
                  embedded ? "flex flex-1 items-center justify-center" : ""
                }`}
              >
                Nenhum compromisso neste dia.
              </p>
            ) : (
              <div className={`mt-4 overflow-y-auto pr-1 ${embedded ? "flex-1" : "max-h-72"}`}>
                <ul className="space-y-2">
                  {dayEvents.map((event) => {
                    const time = formatAgendaTime(event.event_time);
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(event)}
                          className="flex w-full items-start gap-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] px-3 py-3 text-left transition hover:border-[var(--toq-accent)]"
                        >
                          <span className="mt-0.5 rounded-full bg-[var(--toq-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--toq-accent)]">
                            {agendaEventTypeLabel(event.event_type)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-[var(--toq-navy)]">
                              {agendaEventDisplayTitle(event)}
                            </span>
                            {time && (
                              <span className="mt-0.5 block text-xs text-[var(--toq-text-muted)]">
                                {time}
                              </span>
                            )}
                            {event.notes && (
                              <span className="mt-1 block text-xs text-[var(--toq-text-muted)]">
                                {event.notes}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      <AgendaEventForm
        open={formOpen}
        dateISO={selectedDate}
        initial={editing}
        onClose={() => {
          if (!formOpen) return;
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={editing ? handleDelete : undefined}
      />
    </div>
  );
}
