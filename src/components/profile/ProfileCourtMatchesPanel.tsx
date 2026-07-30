"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  COURT_BOOKING_STATUS_LABELS,
  fetchMyCourtBookings,
} from "@/lib/courtManagement";
import { formatClubPrice } from "@/lib/clubFeatures";
import { groupDetailHref } from "@/lib/communityGroup";
import type { CourtBookingWithDetails } from "@/types/courtManagement";

type Props = {
  userId: string;
  isOwnProfile: boolean;
};

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

export function ProfileCourtMatchesPanel({ userId, isOwnProfile }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<CourtBookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyCourtBookings(supabase, userId);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as partidas.");
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-[var(--toq-profile-muted)]">Carregando partidas…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--toq-profile-border)] bg-slate-50/80 px-6 text-center">
        <p className="text-base font-bold text-[var(--toq-profile-navy)]">Nenhuma partida ainda</p>
        <p className="mt-2 max-w-sm text-sm text-[var(--toq-profile-muted)]">
          {isOwnProfile
            ? "Quando você reservar uma quadra (ou for convidado), a partida aparece aqui e na sua agenda."
            : "Este jogador ainda não tem reservas de quadra visíveis."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="profile-section-label">Partidas em quadras</p>
      <ul className="space-y-3">
        {items.map((b) => {
          const clubSlug = b.court?.community?.slug;
          const clubHref = clubSlug ? `${groupDetailHref("club", clubSlug)}?tab=courts` : null;
          const players =
            b.players
              ?.map((p) => (p.profile?.username ? `@${p.profile.username}` : null))
              .filter(Boolean)
              .join(" · ") ?? "";
          const requester = b.requester?.username ? `@${b.requester.username}` : b.guest_name;

          return (
            <li
              key={b.id}
              className="rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[var(--toq-profile-navy)]">{b.court?.name ?? "Quadra"}</p>
                  <p className="text-xs text-[var(--toq-profile-muted)]">
                    {b.court?.community?.name}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--toq-profile-accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--toq-profile-accent)]">
                  {COURT_BOOKING_STATUS_LABELS[b.status] ?? b.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--toq-profile-navy)]">
                {formatDateBR(b.booking_date)} · {formatTime(b.start_time)}–{formatTime(b.end_time)}
              </p>
              {requester && (
                <p className="mt-1 text-xs text-[var(--toq-profile-muted)]">Reservado por {requester}</p>
              )}
              {players && (
                <p className="mt-0.5 text-xs text-[var(--toq-profile-muted)]">Jogadores: {players}</p>
              )}
              <p className="mt-1 text-sm font-semibold text-[var(--toq-profile-accent)]">
                {formatClubPrice(Number(b.total_price))}
              </p>
              {clubHref && (
                <Link
                  href={clubHref}
                  className="mt-2 inline-block text-xs font-bold text-[var(--toq-profile-accent)] hover:underline"
                >
                  Ver clube →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
