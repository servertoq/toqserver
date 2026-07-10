"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { courtSizeLabel } from "@/lib/courts";
import { formatClubPrice } from "@/lib/clubFeatures";
import { recordClubCourtListingView } from "@/lib/courtManagement";
import { fetchClubCourtDetail, type BrowsableClubCourt } from "@/lib/clubCourtBrowse";
import { groupDetailHref } from "@/lib/communityGroup";
import { CourtBookingDialog } from "@/components/court/CourtBookingDialog";

export function ClubCourtBrowseCard({ court }: { court: BrowsableClubCourt }) {
  const minPrice = (court.plans ?? [])
    .filter((p) => p.is_active !== false)
    .map((p) => Number(p.price))
    .sort((a, b) => a - b)[0];
  const rentalOpen = court.rental_available !== false;

  return (
    <Link
      href={`/inicio/quadras/clube/${court.id}`}
      className="block overflow-hidden toq-card p-4 shadow-sm transition hover:border-[var(--toq-sky)]/40 hover:shadow-md"
    >
      {court.images?.[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={court.images[0].url} alt="" className="mb-3 aspect-[4/3] w-full rounded-xl object-cover" />
      )}
      <h3 className="font-bold text-[var(--toq-navy)]">{court.name}</h3>
      {!rentalOpen && (
        <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
          Indisponível para locação
        </span>
      )}
      <p className="mt-1 text-xs font-semibold text-[var(--toq-accent)]">{courtSizeLabel(court.size_label)}</p>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--toq-text-muted)]">{court.description}</p>
      <p className="mt-3 text-xs text-[var(--toq-text-muted)]">
        {court.community?.name}
        {court.rental_visibility === "members_only" ? " · Membros" : " · Pública"}
      </p>
      {minPrice != null && (
        <p className="mt-2 text-xs font-bold text-[var(--toq-navy)]">A partir de {formatClubPrice(minPrice)}</p>
      )}
    </Link>
  );
}

export function ClubCourtDetailPage({ court: initial }: { court: BrowsableClubCourt }) {
  const supabase = createClient();
  const profile = useAppProfile();
  const [court, setCourt] = useState(initial);
  const [bookingOpen, setBookingOpen] = useState(false);

  const refreshCourt = useCallback(async () => {
    const row = await fetchClubCourtDetail(supabase, court.id, profile.id);
    if (row) setCourt(row);
  }, [court.id, profile.id, supabase]);

  useEffect(() => {
    void recordClubCourtListingView(supabase, court.id);
  }, [court.id, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`club-court-detail-${court.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_court_blocks",
          filter: `court_id=eq.${court.id}`,
        },
        () => {
          void refreshCourt();
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
          void refreshCourt();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "club_courts",
          filter: `id=eq.${court.id}`,
        },
        () => {
          void refreshCourt();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [court.id, refreshCourt, supabase]);

  const minPrice = (court.plans ?? [])
    .filter((p) => p.is_active !== false)
    .map((p) => Number(p.price))
    .sort((a, b) => a - b)[0];
  const rentalOpen = court.rental_available !== false;

  return (
    <>
      <Link href="/inicio/quadras" className="mb-4 inline-block text-xs font-semibold text-[var(--toq-sky)]">
        ← Quadras
      </Link>

      <article className="overflow-hidden toq-card-lg">
        {court.images?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={court.images[0].url} alt="" className="aspect-[16/10] w-full object-cover" />
        )}
        <div className="p-5 sm:p-6">
          <h1 className="text-xl font-bold text-[var(--toq-navy)]">{court.name}</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--toq-accent)]">{courtSizeLabel(court.size_label)}</p>
          {court.community?.slug && (
            <Link
              href={groupDetailHref("club", court.community.slug)}
              className="mt-2 inline-block text-xs font-semibold text-[var(--toq-sky)]"
            >
              Clube {court.community.name}
            </Link>
          )}
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-navy)]">
            {court.description}
          </p>
          {minPrice != null && rentalOpen && (
            <p className="mt-4 text-sm font-bold text-[var(--toq-accent)]">
              A partir de {formatClubPrice(minPrice)}
            </p>
          )}
          {!rentalOpen ? (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-amber-600">Indisponível para locação</p>
              {court.rental_unavailable_note && (
                <p className="mt-1 text-xs text-[var(--toq-text-muted)]">{court.rental_unavailable_note}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="mt-5 rounded-lg toq-btn-primary px-5 py-2.5 text-sm font-bold text-white"
            >
              Agendar
            </button>
          )}
        </div>
      </article>

      <CourtBookingDialog
        open={bookingOpen}
        court={court}
        clubName={court.community?.name ?? "Clube"}
        onClose={() => setBookingOpen(false)}
      />
    </>
  );
}
