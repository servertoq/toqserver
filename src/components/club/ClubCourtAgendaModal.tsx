"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import type { ClubCourt, ClubCourtBlock, ClubCourtHours } from "@/types/clubFeatures";

const SLOT_STEP = 30;

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

function isValidTimeHHMM(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
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
      ? "border-red-400 bg-red-100"
      : status === "partial"
        ? "border-amber-400 bg-amber-100"
        : status === "closed"
          ? "border-slate-200 bg-slate-100"
          : "border-emerald-200 bg-emerald-50";
  const selected = isSelected ? "ring-2 ring-[var(--toq-navy)] ring-offset-1" : "";
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
  const [rangeStartMin, setRangeStartMin] = useState<number | null>(null);
  const [formStart, setFormStart] = useState("08:00");
  const [formEnd, setFormEnd] = useState("10:00");
  const [reason, setReason] = useState("Locado");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDates = useMemo(() => weekDatesFromStart(weekStart), [weekStart]);
  const hours = court.hours ?? [];
  const blocks = court.blocks ?? [];

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
    setRangeStartMin(null);
  }

  function goToday() {
    setWeekStart(startOfWeekMonday(new Date()));
    setSelectedDate(todayISO);
    setRangeStartMin(null);
  }

  async function createBlock(startMin: number, endMin: number) {
    if (!canManage) return;
    if (endMin <= startMin) {
      setError("O horário final deve ser depois do inicial.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const startTs = new Date(`${selectedDate}T${minutesToHHMM(startMin)}:00`);
      const endTs = new Date(`${selectedDate}T${minutesToHHMM(endMin)}:00`);
      const { error: blkErr } = await supabase.from("club_court_blocks").insert({
        court_id: court.id,
        start_ts: startTs.toISOString(),
        end_ts: endTs.toISOString(),
        reason: reason.trim() || null,
        created_by: profile.id,
      });
      if (blkErr) {
        setError(blkErr.message);
        return;
      }
      setRangeStartMin(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(blockId: string) {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    try {
      const { error: delErr } = await supabase.from("club_court_blocks").delete().eq("id", blockId);
      if (delErr) {
        setError(delErr.message);
        return;
      }
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  function handleSlotClick(slot: AgendaSlot) {
    if (saving) return;

    if (slot.status === "blocked" && slot.block) {
      if (!canManage) return;
      if (confirm("Remover este horário locado/bloqueado?")) {
        void removeBlock(slot.block.id);
      }
      return;
    }

    if (!canManage) return;

    if (rangeStartMin === null) {
      setRangeStartMin(slot.startMin);
      return;
    }

    const start = Math.min(rangeStartMin, slot.startMin);
    const end = Math.max(rangeStartMin, slot.endMin);
    void createBlock(start, end);
  }

  function isSlotInPendingRange(slot: AgendaSlot) {
    if (rangeStartMin === null) return false;
    return slot.startMin === rangeStartMin;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-200 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--toq-navy)]">Agenda da quadra</h2>
              <p className="mt-0.5 text-sm font-semibold text-[var(--toq-navy)]">{court.name}</p>
              <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
                {canManage
                  ? "Marque dia e horário já locados. Na semana: amarelo = parte do dia reservada, vermelho = dia lotado."
                  : "Na semana: amarelo = algumas horas reservadas, vermelho = dia inteiro lotado. Atualiza em tempo real."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-sm font-semibold text-[var(--toq-text-muted)]"
            >
              Fechar
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftWeek(-1)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-[var(--toq-navy)]"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[var(--toq-navy)]"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-[var(--toq-navy)]"
              >
                ›
              </button>
            </div>
            <span className="text-xs font-semibold text-[var(--toq-text-muted)]">{weekLabel}</span>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {weekSummary.map((day) => {
              const isSelected = day.iso === selectedDate;
              const isToday = day.iso === todayISO;
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day.iso);
                    setRangeStartMin(null);
                  }}
                  className={`rounded-xl border px-1 py-2 text-center transition hover:opacity-90 ${dayCardClasses(day.fill, isSelected)}`}
                >
                  <span className="block text-[10px] font-bold text-[var(--toq-navy)]">
                    {weekdayLabel(day.weekday)}
                  </span>
                  <span
                    className={`mt-0.5 block text-sm font-bold ${
                      isToday ? "text-[var(--toq-sky)]" : "text-[var(--toq-navy)]"
                    }`}
                  >
                    {parseISODate(day.iso).getDate()}
                  </span>
                  {day.fill === "closed" ? (
                    <span className="mt-1 block text-[9px] text-slate-500">Fechado</span>
                  ) : (
                    <span
                      className={`mt-1 block text-[9px] font-semibold ${
                        day.fill === "full"
                          ? "text-red-800"
                          : day.fill === "partial"
                            ? "text-amber-800"
                            : "text-emerald-800"
                      }`}
                    >
                      {day.blocked}/{day.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-50" />
              Dia livre
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-amber-400 bg-amber-100" />
              Parte reservada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-red-400 bg-red-100" />
              Dia lotado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-slate-200 bg-slate-100" />
              Fechado
            </span>
            {canManage && rangeStartMin !== null && (
              <span className="text-[var(--toq-sky)]">
                Início: {minutesToHHMM(rangeStartMin)} — escolha o fim
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[var(--toq-navy)]">
              {parseISODate(selectedDate).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                selectedDayFill === "full"
                  ? "bg-red-200 text-red-900"
                  : selectedDayFill === "partial"
                    ? "bg-amber-200 text-amber-900"
                    : selectedDayFill === "closed"
                      ? "bg-slate-200 text-slate-700"
                      : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {dayFillLabel(selectedDayFill)}
            </span>
          </div>

          {canManage && daySlots.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-[var(--toq-navy)]">Marcar locação (dia e horário)</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[10px] font-semibold text-[var(--toq-navy)]">Início</span>
                  <input
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    placeholder="08:00"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-[var(--toq-navy)]">Fim</span>
                  <input
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    placeholder="10:00"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (!isValidTimeHHMM(formStart) || !isValidTimeHHMM(formEnd)) {
                        setError("Use horários no formato HH:MM (ex.: 08:00).");
                        return;
                      }
                      const start = toMinutes(`${formStart}:00`);
                      const end = toMinutes(`${formEnd}:00`);
                      void createBlock(start, end);
                    }}
                    className="w-full rounded-lg bg-[var(--toq-navy)] py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Marcar locado
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-[var(--toq-text-muted)]">
                Ou clique em dois horários na grade abaixo (início e fim).
              </p>
            </div>
          )}

          {daySlots.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-[var(--toq-text-muted)]">
              Quadra fechada neste dia. Ajuste o funcionamento em Editar quadra.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {daySlots.map((slot) => {
                const pending = isSlotInPendingRange(slot);
                const blocked = slot.status === "blocked";
                return (
                  <button
                    key={slot.startMin}
                    type="button"
                    disabled={saving || (!canManage && !blocked)}
                    onClick={() => handleSlotClick(slot)}
                    className={`rounded-lg border px-2 py-2.5 text-xs font-bold transition disabled:cursor-default ${
                      blocked
                        ? "border-red-300 bg-red-100 text-red-800 hover:bg-red-200"
                        : pending
                          ? "border-[var(--toq-sky)] bg-[var(--toq-sky)]/10 text-[var(--toq-navy)] ring-2 ring-[var(--toq-sky)]"
                          : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400"
                    } ${!canManage && !blocked ? "opacity-90" : ""}`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}

          {canManage && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="flex-1 min-w-[12rem]">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Motivo (novos bloqueios)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Locado"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              {rangeStartMin !== null && (
                <button
                  type="button"
                  onClick={() => setRangeStartMin(null)}
                  className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[var(--toq-navy)]"
                >
                  Cancelar seleção
                </button>
              )}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-[var(--toq-navy)]">Locações do dia</p>
            {dayBlocks.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--toq-text-muted)]">Nenhum horário marcado.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dayBlocks.map((b) => {
                  const range = blockRangeOnDay(b, selectedDate);
                  return (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                    >
                      <span className="text-xs text-[var(--toq-text-muted)]">
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
                          onClick={() => void removeBlock(b.id)}
                          disabled={saving}
                          className="text-xs font-semibold text-red-600 disabled:opacity-50"
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
  );
}
