"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAppProfile } from "@/components/app/AppShell";
import type { ClubCourt, ClubCourtBlock, ClubCourtHours } from "@/types/clubFeatures";

const SLOT_STEP = 60;

type AgendaSlot = {
  startMin: number;
  endMin: number;
  label: string;
  status: "available" | "blocked";
  block?: ClubCourtBlock;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toMinutes(hms: string) {
  const [h, m] = hms.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function minutesToHHMM(min: number) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseISODate(iso: string) {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

function startOfWeekMonday(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function weekDatesFromStart(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return toISODate(d);
  });
}

function weekdayLabel(d: number) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d] ?? String(d);
}

function blocksForDay(blocks: ClubCourtBlock[], dateISO: string) {
  const dayStart = new Date(`${dateISO}T00:00:00`).getTime();
  const dayEnd = new Date(`${dateISO}T23:59:59.999`).getTime();
  return blocks.filter((b) => {
    const s = new Date(b.start_ts).getTime();
    const e = new Date(b.end_ts).getTime();
    return s < dayEnd && e > dayStart;
  });
}

function rangeOverlapsExistingBlocks(
  blocks: ClubCourtBlock[],
  dateISO: string,
  startMin: number,
  endMin: number
) {
  return blocksForDay(blocks, dateISO).some((b) => {
    const range = blockRangeOnDay(b, dateISO);
    if (!range) return false;
    return overlaps(startMin, endMin, range.startMin, range.endMin);
  });
}

function blockRangeOnDay(block: ClubCourtBlock, dateISO: string) {
  const dayStart = new Date(`${dateISO}T00:00:00`).getTime();
  const s = new Date(block.start_ts).getTime();
  const e = new Date(block.end_ts).getTime();
  const startMin = Math.max(0, Math.floor((s - dayStart) / 60000));
  const endMin = Math.min(24 * 60, Math.ceil((e - dayStart) / 60000));
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

function buildSlotsForDay(
  hours: ClubCourtHours[],
  weekday: number,
  blocks: ClubCourtBlock[],
  dateISO: string
): AgendaSlot[] {
  const windows = hours.filter((h) => h.weekday === weekday);
  if (windows.length === 0) return [];

  const dayBlocks = blocksForDay(blocks, dateISO);
  const slots: AgendaSlot[] = [];

  for (const w of windows) {
    const wStart = toMinutes(w.start_time);
    const wEnd = toMinutes(w.end_time);
    for (let t = wStart; t + SLOT_STEP <= wEnd; t += SLOT_STEP) {
      let status: "available" | "blocked" = "available";
      let block: ClubCourtBlock | undefined;
      for (const b of dayBlocks) {
        const range = blockRangeOnDay(b, dateISO);
        if (!range) continue;
        if (overlaps(t, t + SLOT_STEP, range.startMin, range.endMin)) {
          status = "blocked";
          block = b;
          break;
        }
      }
      slots.push({
        startMin: t,
        endMin: t + SLOT_STEP,
        label: minutesToHHMM(t),
        status,
        block,
      });
    }
  }

  return slots;
}

function countBlockedSlots(slots: AgendaSlot[]) {
  return slots.filter((s) => s.status === "blocked").length;
}

type DayFillStatus = "closed" | "full" | "partial" | "open";

function dayFillStatus(blocked: number, total: number): DayFillStatus {
  if (total === 0) return "closed";
  if (blocked >= total) return "full";
  if (blocked > 0) return "partial";
  return "open";
}

function dayFillLabel(status: DayFillStatus) {
  if (status === "full") return "Dia lotado";
  if (status === "partial") return "Parcialmente reservado";
  if (status === "closed") return "Fechado";
  return "Disponível";
}

function dayCardClasses(status: DayFillStatus, isSelected: boolean) {
  const base =
    status === "full"
      ? "border-red-400/80 bg-red-500/15"
      : status === "partial"
        ? "border-amber-400/80 bg-amber-500/15"
        : status === "closed"
          ? "border-[var(--toq-border)] bg-[var(--toq-surface)]"
          : "border-emerald-500/40 bg-emerald-500/10";
  const selected = isSelected ? "ring-2 ring-[var(--toq-accent)] ring-offset-1 ring-offset-[var(--toq-card)]" : "";
  return `${base} ${selected}`;
}

type Props = {
  canManage: boolean;
  court: ClubCourt;
  onClose: () => void;
  onChanged: () => void;
};

export function ClubCourtAgendaModal({ canManage, court, onClose, onChanged }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();

  const todayISO = toISODate(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [selectedStarts, setSelectedStarts] = useState<number[]>([]);
  const [reason, setReason] = useState("Locado");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; timeLabel: string } | null>(null);
  const [localBlocks, setLocalBlocks] = useState<ClubCourtBlock[]>(court.blocks ?? []);

  const refreshLocalBlocks = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from("club_court_blocks")
      .select("id, court_id, start_ts, end_ts, reason")
      .eq("court_id", court.id)
      .order("start_ts");

    if (!fetchErr) {
      setLocalBlocks((data ?? []) as ClubCourtBlock[]);
    }
  }, [court.id, supabase]);

  useEffect(() => {
    setLocalBlocks(court.blocks ?? []);
  }, [court.blocks, court.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`club-court-agenda-${court.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_court_blocks",
          filter: `court_id=eq.${court.id}`,
        },
        () => {
          void refreshLocalBlocks();
          onChanged();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [court.id, onChanged, refreshLocalBlocks, supabase]);

  const weekDates = useMemo(() => weekDatesFromStart(weekStart), [weekStart]);
  const hours = court.hours ?? [];
  const blocks = localBlocks;

  const weekSummary = useMemo(() => {
    return weekDates.map((iso) => {
      const wd = parseISODate(iso).getDay();
      const slots = buildSlotsForDay(hours, wd, blocks, iso);
      const blocked = countBlockedSlots(slots);
      const total = slots.length;
      return {
        iso,
        weekday: wd,
        total,
        blocked,
        fill: dayFillStatus(blocked, total),
      };
    });
  }, [blocks, hours, weekDates]);

  const selectedWeekday = parseISODate(selectedDate).getDay();
  const daySlots = useMemo(
    () => buildSlotsForDay(hours, selectedWeekday, blocks, selectedDate),
    [blocks, hours, selectedDate, selectedWeekday]
  );

  useEffect(() => {
    setSelectedStarts([]);
    setError(null);
  }, [selectedDate]);

  const selectedSlots = useMemo(
    () =>
      daySlots.filter(
        (s) => s.status === "available" && selectedStarts.includes(s.startMin)
      ),
    [daySlots, selectedStarts]
  );

  const selectedRanges = useMemo(() => {
    if (selectedSlots.length === 0) return [] as Array<{ startMin: number; endMin: number }>;
    const sorted = [...selectedSlots].sort((a, b) => a.startMin - b.startMin);
    const ranges: Array<{ startMin: number; endMin: number }> = [];
    for (const slot of sorted) {
      const last = ranges[ranges.length - 1];
      if (last && last.endMin === slot.startMin) {
        last.endMin = slot.endMin;
      } else {
        ranges.push({ startMin: slot.startMin, endMin: slot.endMin });
      }
    }
    return ranges;
  }, [selectedSlots]);

  const selectionSummary = useMemo(() => {
    if (selectedRanges.length === 0) return null;
    return selectedRanges
      .map((r) => `${minutesToHHMM(r.startMin)}–${minutesToHHMM(r.endMin)}`)
      .join(", ");
  }, [selectedRanges]);

  const selectedDayFill = useMemo(() => {
    const blocked = countBlockedSlots(daySlots);
    return dayFillStatus(blocked, daySlots.length);
  }, [daySlots]);

  const dayBlocks = useMemo(
    () =>
      blocksForDay(blocks, selectedDate)
        .slice()
        .sort((a, b) => a.start_ts.localeCompare(b.start_ts)),
    [blocks, selectedDate]
  );

  const weekLabel = useMemo(() => {
    const start = parseISODate(weekDates[0]);
    const end = parseISODate(weekDates[6]);
    const fmt = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [weekDates]);

  function shiftWeek(delta: number) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
  }

  function goToday() {
    setWeekStart(startOfWeekMonday(new Date()));
    setSelectedDate(todayISO);
  }

  async function createBlocks(
    ranges: Array<{ startMin: number; endMin: number }>
  ) {
    if (!canManage || ranges.length === 0) return;

    for (const range of ranges) {
      if (range.endMin <= range.startMin) {
        setError("O horário final deve ser depois do inicial.");
        return;
      }
      if (rangeOverlapsExistingBlocks(blocks, selectedDate, range.startMin, range.endMin)) {
        setError("Um dos horários selecionados já está reservado neste dia.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const rows = ranges.map((range) => ({
        court_id: court.id,
        start_ts: new Date(`${selectedDate}T${minutesToHHMM(range.startMin)}:00`).toISOString(),
        end_ts: new Date(`${selectedDate}T${minutesToHHMM(range.endMin)}:00`).toISOString(),
        reason: reason.trim() || null,
        created_by: profile.id,
      }));
      const { error: blkErr } = await supabase.from("club_court_blocks").insert(rows);
      if (blkErr) {
        setError(
          blkErr.message.includes("Horário já reservado")
            ? "Um dos horários selecionados já está reservado neste dia."
            : blkErr.message
        );
        return;
      }
      setSelectedStarts([]);
      await refreshLocalBlocks();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(blockId: string): Promise<boolean> {
    if (!canManage) return false;
    setSaving(true);
    setError(null);
    try {
      const { error: delErr } = await supabase.from("club_court_blocks").delete().eq("id", blockId);
      if (delErr) {
        setError(delErr.message);
        return false;
      }
      await refreshLocalBlocks();
      onChanged();
      return true;
    } finally {
      setSaving(false);
    }
  }

  function handleSlotClick(slot: AgendaSlot) {
    if (saving) return;

    if (slot.status === "blocked" && slot.block) {
      if (!canManage) return;
      setRemoveTarget({
        id: slot.block.id,
        timeLabel: `${slot.label}–${minutesToHHMM(slot.endMin)}`,
      });
      return;
    }

    if (!canManage) return;

    setError(null);
    setSelectedStarts((prev) =>
      prev.includes(slot.startMin)
        ? prev.filter((m) => m !== slot.startMin)
        : [...prev, slot.startMin].sort((a, b) => a - b)
    );
  }

  async function handleSaveBooking() {
    if (selectedRanges.length === 0) {
      setError("Selecione um ou mais horários livres na grade.");
      return;
    }
    await createBlocks(selectedRanges);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-3">
      <div className="flex max-h-[min(88vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-xl">
        <div className="shrink-0 border-b border-[var(--toq-border)] p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--toq-navy)]">Agenda da quadra</h2>
              <p className="truncate text-sm font-semibold text-[var(--toq-navy)]">{court.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-[var(--toq-border)] px-2.5 py-1 text-xs font-bold text-[var(--toq-navy)]"
            >
              Fechar
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftWeek(-1)}
                className="toq-btn-outline rounded-lg px-2 py-1 text-sm font-bold"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={goToday}
                className="toq-btn-outline rounded-lg px-2.5 py-1 text-[11px] font-bold"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                className="toq-btn-outline rounded-lg px-2 py-1 text-sm font-bold"
              >
                ›
              </button>
            </div>
            <span className="text-[11px] font-semibold text-[var(--toq-text-muted)]">{weekLabel}</span>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {weekSummary.map((day) => {
              const isSelected = day.iso === selectedDate;
              const isToday = day.iso === todayISO;
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => setSelectedDate(day.iso)}
                  className={`rounded-lg border px-0.5 py-1.5 text-center transition hover:opacity-90 ${dayCardClasses(day.fill, isSelected)}`}
                >
                  <span className="block text-[9px] font-bold text-[var(--toq-navy)]">
                    {weekdayLabel(day.weekday)}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs font-bold ${
                      isToday ? "text-[var(--toq-accent)]" : "text-[var(--toq-navy)]"
                    }`}
                  >
                    {parseISODate(day.iso).getDate()}
                  </span>
                  {day.fill === "closed" ? (
                    <span className="mt-0.5 block text-[8px] text-[var(--toq-text-muted)]">—</span>
                  ) : (
                    <span className="mt-0.5 block text-[8px] font-semibold text-[var(--toq-text-muted)]">
                      {day.blocked}/{day.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-semibold text-[var(--toq-text-muted)]">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded border border-emerald-500/50 bg-emerald-500/15" />
              Livre
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded border border-amber-400/80 bg-amber-500/15" />
              Parcial
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded border border-red-400/80 bg-red-500/15" />
              Lotado
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[var(--toq-navy)]">
              {parseISODate(selectedDate).toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                selectedDayFill === "full"
                  ? "bg-red-500/20 text-red-700 dark:text-red-300"
                  : selectedDayFill === "partial"
                    ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                    : selectedDayFill === "closed"
                      ? "bg-[var(--toq-surface)] text-[var(--toq-text-muted)]"
                      : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              }`}
            >
              {dayFillLabel(selectedDayFill)}
            </span>
          </div>

          {daySlots.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[var(--toq-border)] bg-[var(--toq-surface)] p-4 text-center text-sm text-[var(--toq-text-muted)]">
              Quadra fechada neste dia.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-7">
              {daySlots.map((slot) => {
                const blocked = slot.status === "blocked";
                const selected = !blocked && selectedStarts.includes(slot.startMin);
                return (
                  <button
                    key={slot.startMin}
                    type="button"
                    disabled={saving || (!canManage && !blocked)}
                    onClick={() => handleSlotClick(slot)}
                    className={`rounded-md border px-1 py-1.5 text-[11px] font-bold transition disabled:cursor-default ${
                      blocked
                        ? "border-red-500/50 bg-red-500/20 text-red-800 dark:text-red-200 hover:bg-red-500/30"
                        : selected
                          ? "border-[var(--toq-accent)] bg-[var(--toq-accent)] text-white"
                          : "border-emerald-500/35 bg-emerald-500/10 text-[var(--toq-navy)] hover:border-emerald-500/60"
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}

          {canManage && daySlots.length > 0 && (
            <div className="mt-3 space-y-2 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-3">
              <p className="text-[11px] text-[var(--toq-text-muted)]">
                {selectionSummary
                  ? `${selectedSlots.length} horário(s): ${selectionSummary}`
                  : "Clique nos horários livres para selecionar (pode marcar vários)."}
              </p>
              <label className="block">
                <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">Motivo</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Locado"
                  className="toq-input mt-0.5 w-full px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={saving || selectedRanges.length === 0}
                onClick={() => void handleSaveBooking()}
                className="toq-btn-primary w-full rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Salvar agendamento"}
              </button>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-3">
            <p className="text-xs font-bold text-[var(--toq-navy)]">Locações do dia</p>
            {dayBlocks.length === 0 ? (
              <p className="mt-1.5 text-xs text-[var(--toq-text-muted)]">Nenhum horário marcado.</p>
            ) : (
              <ul className="mt-2 max-h-28 space-y-1.5 overflow-y-auto">
                {dayBlocks.map((b) => {
                  const range = blockRangeOnDay(b, selectedDate);
                  return (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--toq-border)] bg-[var(--toq-card)] px-2.5 py-1.5"
                    >
                      <span className="text-[11px] text-[var(--toq-navy)]">
                        {range
                          ? `${minutesToHHMM(range.startMin)}–${minutesToHHMM(range.endMin)}`
                          : new Date(b.start_ts).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() =>
                            setRemoveTarget({
                              id: b.id,
                              timeLabel: `${new Date(b.start_ts).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}–${new Date(b.end_ts).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`,
                            })
                          }
                          disabled={saving}
                          className="text-[11px] font-semibold text-red-600 disabled:opacity-50"
                        >
                          Remover
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remover locação"
        message={
          removeTarget
            ? `Remover o horário ${removeTarget.timeLabel}? Esta ação libera o slot na agenda.`
            : ""
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        loading={saving}
        priority="high"
        onConfirm={() => {
          if (!removeTarget) return;
          void removeBlock(removeTarget.id).then((ok) => {
            if (ok) setRemoveTarget(null);
          });
        }}
        onCancel={() => {
          if (!saving) setRemoveTarget(null);
        }}
      />
    </>
  );
}
