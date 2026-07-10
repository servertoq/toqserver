"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { formatClubPrice } from "@/lib/clubFeatures";
import { groupDetailHref } from "@/lib/communityGroup";
import {
  COURT_BOOKING_STATUS_LABELS,
  cancelCourtBooking,
  completeCourtBooking,
  createManualCourtBooking,
  emptyManualCourtBookingForm,
  fetchCourtManagementStats,
  fetchManagedCourtBookings,
  fetchManagedCourts,
  markCourtBookingPaid,
  reviewCourtBooking,
  setCourtRentalAvailability,
} from "@/lib/courtManagement";
import type { ClubCourtPlan } from "@/types/clubFeatures";
import type { CourtBookingWithDetails } from "@/types/courtManagement";
import { appContentClass } from "@/lib/layout";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Tab = "dashboard" | "pending" | "bookings" | "manual";

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

export function CourtManagementPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bookings, setBookings] = useState<CourtBookingWithDetails[]>([]);
  const [courts, setCourts] = useState<Awaited<ReturnType<typeof fetchManagedCourts>>>([]);
  const [stats, setStats] = useState({ listing_views: 0, bookings_count: 0, total_revenue: 0 });
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualForm, setManualForm] = useState(emptyManualCourtBookingForm());
  const [rentalNotes, setRentalNotes] = useState<Record<string, string>>({});
  const [savingRentalId, setSavingRentalId] = useState<string | null>(null);
  const { isSubmitting: savingManual, guard: guardManual } = useSingleSubmit();

  const refreshData = useCallback(async () => {
    const [bookingRows, courtRows, statRows] = await Promise.all([
      fetchManagedCourtBookings(supabase),
      fetchManagedCourts(supabase, profile.id),
      fetchCourtManagementStats(supabase, fromDate, toDate),
    ]);
    setBookings(bookingRows);
    setCourts(courtRows);
    setStats(statRows);
    if (courtRows.length > 0 && !manualForm.court_id) {
      const first = courtRows[0];
      const firstPlan = first.plans?.[0];
      setManualForm(emptyManualCourtBookingForm(first.id, firstPlan?.id ?? ""));
    }
  }, [fromDate, manualForm.court_id, profile.id, supabase, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [refreshData]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`court-management-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_court_blocks" },
        () => {
          void refreshData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_court_bookings" },
        () => {
          void refreshData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.id, refreshData, supabase]);

  const pendingTabItems = useMemo(
    () => bookings.filter((b) => b.status === "pending" || b.status === "awaiting_payment"),
    [bookings]
  );
  const activeBookings = useMemo(
    () => bookings.filter((b) => ["confirmed", "completed"].includes(b.status)),
    [bookings]
  );

  const selectedCourt = courts.find((c) => c.id === manualForm.court_id);
  const courtPlans = (selectedCourt?.plans?.filter((p: ClubCourtPlan) => p.is_active !== false) ??
    []) as ClubCourtPlan[];

  async function runAction(fn: () => Promise<{ error: string | null }>, okMsg: string) {
    const { error: err } = await fn();
    if (err) {
      setError(err);
      setMessage(null);
      return;
    }
    setError(null);
    setMessage(okMsg);
    await load();
  }

  async function updateCourtRental(courtId: string, available: boolean, note?: string) {
    setSavingRentalId(courtId);
    setError(null);
    const { error: err } = await setCourtRentalAvailability(supabase, courtId, available, note);
    setSavingRentalId(null);
    if (err) {
      setError(err);
      return;
    }
    setMessage(
      available
        ? "Quadra liberada para locação."
        : "Quadra indisponível — novas locações online estão bloqueadas."
    );
    await load();
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    await guardManual(async () => {
      setError(null);
      const { error: err } = await createManualCourtBooking(supabase, manualForm);
      if (err) {
        setError(err);
        return;
      }
      setMessage("Agendamento manual registrado.");
      setManualForm(emptyManualCourtBookingForm(manualForm.court_id, manualForm.plan_id));
      await load();
    });
  }

  return (
    <main className={appContentClass}>
      <PageHeader
        kicker="Clube"
        title="Gestão de Quadras"
        subtitle="Para administradores e moderadores: aprove solicitações, confirme pagamentos e acompanhe resultados."
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--toq-border)] pb-1">
        {(
          [
            ["dashboard", "Dashboard"],
            ["pending", `Pendentes (${pendingTabItems.length})`],
            ["bookings", "Agendamentos"],
            ["manual", "Agendar manual"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-t-lg px-3 py-2 text-sm font-semibold transition ${
              tab === id
                ? "border-b-2 border-[var(--toq-accent)] text-[var(--toq-navy)]"
                : "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700" role="status">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
      ) : courts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--toq-border)] bg-[var(--toq-card)] p-8 text-center">
          <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhuma quadra para gerenciar</p>
          <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
            Cadastre quadras na aba Quadras de um clube que você administra.
          </p>
        </div>
      ) : (
        <>
          {tab === "dashboard" && (
            <section className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <label className="text-xs font-semibold text-[var(--toq-navy)]">
                  De
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="toq-input mt-1 block px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--toq-navy)]">
                  Até
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="toq-input mt-1 block px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="self-end rounded-lg toq-btn-outline px-4 py-2 text-xs font-bold"
                >
                  Atualizar
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-5">
                  <p className="text-xs font-bold uppercase text-[var(--toq-text-muted)]">Cliques no anúncio</p>
                  <p className="mt-2 text-3xl font-bold text-[var(--toq-navy)]">{stats.listing_views}</p>
                </div>
                <div className="rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-5">
                  <p className="text-xs font-bold uppercase text-[var(--toq-text-muted)]">Agendamentos</p>
                  <p className="mt-2 text-3xl font-bold text-[var(--toq-navy)]">{stats.bookings_count}</p>
                </div>
                <div className="rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-5">
                  <p className="text-xs font-bold uppercase text-[var(--toq-text-muted)]">Receita confirmada</p>
                  <p className="mt-2 text-3xl font-bold text-[var(--toq-accent)]">
                    {formatClubPrice(stats.total_revenue)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-5">
                <h3 className="text-sm font-bold text-[var(--toq-navy)]">Suas quadras</h3>
                <ul className="mt-3 space-y-3">
                  {courts.map((court) => {
                    const rentalOpen = court.rental_available !== false;
                    const noteValue =
                      rentalNotes[court.id] ?? court.rental_unavailable_note ?? "";
                    return (
                    <li
                      key={court.id}
                      className="rounded-xl border border-[var(--toq-border)] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--toq-navy)]">{court.name}</p>
                        <p className="text-xs text-[var(--toq-text-muted)]">
                          {court.community?.name} ·{" "}
                          {court.rental_visibility === "public" ? "Pública" : "Só membros"}
                        </p>
                        {!rentalOpen && (
                          <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                            Indisponível para locação
                          </span>
                        )}
                      </div>
                      {court.community?.slug && (
                        <Link
                          href={`${groupDetailHref("club", court.community.slug)}?tab=courts`}
                          className="text-xs font-bold text-[var(--toq-sky)]"
                        >
                          Editar no clube
                        </Link>
                      )}
                      </div>

                      <div className="mt-3 border-t border-[var(--toq-border)] pt-3">
                        <label className="flex cursor-pointer items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-[var(--toq-navy)]">
                            Disponível para locação
                          </span>
                          <input
                            type="checkbox"
                            checked={rentalOpen}
                            disabled={savingRentalId === court.id}
                            onChange={(e) => {
                              const next = e.target.checked;
                              void updateCourtRental(
                                court.id,
                                next,
                                next ? undefined : noteValue
                              );
                            }}
                            className="h-4 w-4 accent-[var(--toq-accent)]"
                          />
                        </label>
                        {!rentalOpen && (
                          <label className="mt-2 block">
                            <span className="text-[10px] font-semibold text-[var(--toq-text-muted)]">
                              Motivo (opcional)
                            </span>
                            <input
                              value={noteValue}
                              onChange={(e) =>
                                setRentalNotes((notes) => ({ ...notes, [court.id]: e.target.value }))
                              }
                              onBlur={() => {
                                if (!rentalOpen) {
                                  void updateCourtRental(court.id, false, noteValue);
                                }
                              }}
                              placeholder="Ex.: em manutenção até sexta"
                              maxLength={200}
                              className="toq-input mt-1 w-full px-2 py-1.5 text-xs"
                            />
                          </label>
                        )}
                        {!rentalOpen && (
                          <p className="mt-2 text-[11px] text-[var(--toq-text-muted)]">
                            Agendamentos manuais pelo painel continuam permitidos.
                          </p>
                        )}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          )}

          {tab === "pending" && (
            <BookingList
              items={pendingTabItems}
              onApprove={(id) => runAction(() => reviewCourtBooking(supabase, id, true), "Solicitação aprovada.")}
              onReject={(id) => runAction(() => reviewCourtBooking(supabase, id, false), "Solicitação recusada.")}
              onMarkPaid={(id) =>
                runAction(() => markCourtBookingPaid(supabase, id), "Pagamento confirmado e horário reservado.")
              }
              onComplete={(id) => runAction(() => completeCourtBooking(supabase, id), "Agendamento concluído.")}
              onCancel={(id) => runAction(() => cancelCourtBooking(supabase, id), "Agendamento cancelado.")}
            />
          )}

          {tab === "bookings" && (
            <BookingList
              items={activeBookings}
              onApprove={() => Promise.resolve()}
              onReject={() => Promise.resolve()}
              onMarkPaid={() => Promise.resolve()}
              onComplete={(id) => runAction(() => completeCourtBooking(supabase, id), "Agendamento concluído.")}
              onCancel={(id) => runAction(() => cancelCourtBooking(supabase, id), "Agendamento cancelado.")}
              hidePendingActions
            />
          )}

          {tab === "manual" && (
            <form onSubmit={handleManualSubmit} className="max-w-lg space-y-4 rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-5">
              <h3 className="text-sm font-bold text-[var(--toq-navy)]">Agendamento presencial</h3>
              <p className="text-xs text-[var(--toq-text-muted)]">
                Use quando alguém chegar no clube e quiser reservar na hora.
              </p>

              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Quadra</span>
                <select
                  value={manualForm.court_id}
                  onChange={(e) => {
                    const court = courts.find((c) => c.id === e.target.value);
                    const planId = court?.plans?.[0]?.id ?? "";
                    setManualForm((f) => ({ ...f, court_id: e.target.value, plan_id: planId }));
                  }}
                  className="toq-input mt-1 w-full px-3 py-2 text-sm"
                >
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.community?.name})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Plano</span>
                <select
                  value={manualForm.plan_id}
                  onChange={(e) => setManualForm((f) => ({ ...f, plan_id: e.target.value }))}
                  className="toq-input mt-1 w-full px-3 py-2 text-sm"
                >
                  {courtPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {formatClubPrice(Number(p.price))}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--toq-navy)]">Data</span>
                  <input
                    type="date"
                    value={manualForm.booking_date}
                    onChange={(e) => setManualForm((f) => ({ ...f, booking_date: e.target.value }))}
                    className="toq-input mt-1 w-full px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--toq-navy)]">Horário</span>
                  <input
                    type="time"
                    value={manualForm.start_time}
                    onChange={(e) => setManualForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="toq-input mt-1 w-full px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome do cliente</span>
                <input
                  value={manualForm.guest_name}
                  onChange={(e) => setManualForm((f) => ({ ...f, guest_name: e.target.value }))}
                  required
                  className="toq-input mt-1 w-full px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">WhatsApp (opcional)</span>
                <input
                  value={manualForm.guest_phone}
                  onChange={(e) => setManualForm((f) => ({ ...f, guest_phone: e.target.value }))}
                  className="toq-input mt-1 w-full px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-[var(--toq-navy)]">
                <input
                  type="checkbox"
                  checked={manualForm.mark_paid}
                  onChange={(e) => setManualForm((f) => ({ ...f, mark_paid: e.target.checked }))}
                />
                Cliente já pagou (bloqueia o horário na agenda)
              </label>

              <button
                type="submit"
                disabled={savingManual}
                className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingManual ? "Salvando…" : "Registrar agendamento"}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}

function BookingList({
  items,
  onApprove,
  onReject,
  onMarkPaid,
  onComplete,
  onCancel,
  hidePendingActions = false,
}: {
  items: CourtBookingWithDetails[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  hidePendingActions?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--toq-text-muted)]">Nenhum agendamento nesta lista.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((b) => {
        const clientName = b.guest_name ?? b.requester?.username ?? "Cliente";
        return (
          <li key={b.id} className="rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-[var(--toq-navy)]">{b.court?.name}</p>
                <p className="text-xs text-[var(--toq-text-muted)]">{b.court?.community?.name}</p>
              </div>
              <span className="rounded-full bg-[var(--toq-surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--toq-navy)]">
                {COURT_BOOKING_STATUS_LABELS[b.status] ?? b.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--toq-navy)]">
              {clientName} · {formatDateBR(b.booking_date)} · {formatTime(b.start_time)}–{formatTime(b.end_time)}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--toq-accent)]">
              {formatClubPrice(Number(b.total_price))}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!hidePendingActions && b.status === "pending" && (
                <>
                  <button
                    type="button"
                    onClick={() => void onApprove(b.id)}
                    className="rounded-lg toq-btn-primary px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => void onReject(b.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600"
                  >
                    Recusar
                  </button>
                </>
              )}
              {!hidePendingActions && b.status === "awaiting_payment" && (
                <button
                  type="button"
                  onClick={() => void onMarkPaid(b.id)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Confirmar pagamento
                </button>
              )}
              {b.status === "confirmed" && (
                <button
                  type="button"
                  onClick={() => void onComplete(b.id)}
                  className="rounded-lg toq-btn-outline px-3 py-1.5 text-xs font-bold"
                >
                  Concluir
                </button>
              )}
              {!["cancelled", "rejected", "completed"].includes(b.status) && (
                <button
                  type="button"
                  onClick={() => void onCancel(b.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600"
                >
                  Cancelar
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
