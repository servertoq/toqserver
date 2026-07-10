"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { formatClubPrice } from "@/lib/clubFeatures";
import { fetchClubCourtTakenRanges } from "@/lib/clubCourtBrowse";
import { requestClubCourtBooking } from "@/lib/courtManagement";
import type { ClubCourt, ClubCourtPlan } from "@/types/clubFeatures";
import type { CourtTakenRange } from "@/lib/clubCourtBrowse";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Props = {
  open: boolean;
  court: ClubCourt;
  clubName: string;
  onClose: () => void;
  onSuccess?: () => void;
};

function toMinutes(hms: string) {
  const [h, m] = hms.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minutesToHHMM(min: number) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function CourtBookingDialog({ open, court, clubName, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const plans = (court.plans ?? []).filter((p) => p.is_active !== false).sort((a, b) => a.sort_order - b.sort_order);
  const hours = (court.hours ?? []).slice();

  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [startHHMM, setStartHHMM] = useState("07:00");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [takenRanges, setTakenRanges] = useState<CourtTakenRange[]>([]);
  const { isSubmitting, guard } = useSingleSubmit();

  const refreshTakenRanges = useCallback(async () => {
    try {
      const ranges = await fetchClubCourtTakenRanges(supabase, court.id, dateISO);
      setTakenRanges(ranges);
    } catch {
      /* mantém última lista conhecida */
    }
  }, [court.id, dateISO, supabase]);

  useEffect(() => {
    if (!open) return;
    void refreshTakenRanges();
  }, [open, refreshTakenRanges]);

  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel(`court-booking-availability-${court.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_court_blocks",
          filter: `court_id=eq.${court.id}`,
        },
        () => {
          void refreshTakenRanges();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_court_bookings",
          filter: `club_court_id=eq.${court.id}`,
        },
        () => {
          void refreshTakenRanges();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [court.id, open, refreshTakenRanges, supabase]);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;

  const weekday = useMemo(() => {
    const d = new Date(`${dateISO}T12:00:00`);
    return Number.isNaN(d.getTime()) ? 0 : d.getDay();
  }, [dateISO]);

  const todaysHours = useMemo(() => hours.filter((h) => h.weekday === weekday), [hours, weekday]);

  const availableStartTimes = useMemo(() => {
    if (!selectedPlan) return [];
    const step = selectedPlan.unit_minutes >= 60 ? 60 : 30;
    const dur = selectedPlan.unit_minutes * Math.max(1, quantity);
    const windowIntervals = todaysHours
      .map((h) => ({ start: toMinutes(h.start_time), end: toMinutes(h.end_time) }))
      .filter((w) => w.end > w.start);
    if (windowIntervals.length === 0) return [];

    const dayStart = new Date(`${dateISO}T00:00:00`).getTime();
    const dayEnd = new Date(`${dateISO}T23:59:59`).getTime();
    const dayBlocks = takenRanges
      .filter((b) => {
        const s = new Date(b.start_ts).getTime();
        const e = new Date(b.end_ts).getTime();
        return overlaps(dayStart, dayEnd, s, e);
      })
      .map((b) => {
        const s = new Date(b.start_ts);
        const e = new Date(b.end_ts);
        return { start: s.getHours() * 60 + s.getMinutes(), end: e.getHours() * 60 + e.getMinutes() };
      });

    const out: string[] = [];
    for (const w of windowIntervals) {
      for (let t = w.start; t + dur <= w.end; t += step) {
        const end = t + dur;
        if (!dayBlocks.some((b) => overlaps(t, end, b.start, b.end))) {
          out.push(minutesToHHMM(t));
        }
      }
    }
    return Array.from(new Set(out));
  }, [dateISO, quantity, selectedPlan, takenRanges, todaysHours]);

  useEffect(() => {
    if (availableStartTimes.length === 0) return;
    if (!availableStartTimes.includes(startHHMM)) {
      setStartHHMM(availableStartTimes[0]!);
    }
  }, [availableStartTimes, startHHMM]);

  const totalPrice = selectedPlan ? Number(selectedPlan.price) * Math.max(1, quantity) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) {
      setError("Selecione um plano.");
      return;
    }
    if (!availableStartTimes.includes(startHHMM)) {
      setError("Horário indisponível. Atualizamos a agenda — escolha outro horário.");
      await refreshTakenRanges();
      return;
    }

    await guard(async () => {
      setError(null);
      const { error: bookingErr } = await requestClubCourtBooking(
        supabase,
        court.id,
        selectedPlan.id,
        dateISO,
        startHHMM,
        quantity
      );
      if (bookingErr) {
        setError(bookingErr);
        return;
      }
      setSuccess(true);
      onSuccess?.();
    });
  }

  if (!open) return null;

  const rentalOpen = court.rental_available !== false;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-white shadow-xl sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--toq-navy)]">Agendar quadra</h2>
          <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
            {court.name} — {clubName}
          </p>
        </div>

        {success ? (
          <div className="space-y-4 p-5">
            <p className="text-sm text-[var(--toq-navy)]">
              Solicitação enviada! O proprietário vai analisar e entrar em contato para confirmar o pagamento antes
              de liberar o horário.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white"
            >
              Fechar
            </button>
          </div>
        ) : !rentalOpen ? (
          <div className="space-y-4 p-5">
            <p className="text-sm font-semibold text-amber-600">Esta quadra está indisponível para locação no momento.</p>
            {court.rental_unavailable_note && (
              <p className="text-sm text-[var(--toq-text-muted)]">{court.rental_unavailable_note}</p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl toq-btn-outline py-2.5 text-sm font-semibold"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Plano</span>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {formatClubPrice(Number(p.price))}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Data</span>
              <input
                type="date"
                value={dateISO}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDateISO(e.target.value)}
                className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Quantidade</span>
              <input
                type="number"
                min={1}
                max={12}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Horário de início</span>
              {availableStartTimes.length === 0 ? (
                <p className="mt-1 text-xs text-red-600">Sem horários livres neste dia.</p>
              ) : (
                <select
                  value={startHHMM}
                  onChange={(e) => setStartHHMM(e.target.value)}
                  className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
                >
                  {availableStartTimes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </label>

            {selectedPlan && (
              <p className="text-sm font-bold text-[var(--toq-accent)]">
                Total estimado: {formatClubPrice(totalPrice)}
              </p>
            )}

            <p className="text-[11px] text-[var(--toq-text-muted)]">
              A reserva fica pendente até o proprietário aprovar e confirmar o pagamento.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[var(--toq-navy)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || availableStartTimes.length === 0}
                className="flex-1 rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSubmitting ? "Enviando…" : "Solicitar agendamento"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
