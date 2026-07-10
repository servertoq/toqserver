"use client";

import Link from "next/link";
import type { FeedClubCourt } from "@/types/courtManagement";

type Props = {
  court: FeedClubCourt;
};

export function CourtListingPostActions({ court }: Props) {
  const rentalOpen = court.rental_available !== false;

  return (
    <div className="coach-listing-post-actions mt-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
        {rentalOpen ? "Quadra disponível para locação" : "Quadra indisponível para locação"}
      </p>
      {court.community_name && (
        <p className="mt-1 text-sm font-semibold text-[var(--toq-navy)]">{court.community_name}</p>
      )}
      {!rentalOpen && court.rental_unavailable_note && (
        <p className="mt-1 text-xs text-[var(--toq-text-muted)]">{court.rental_unavailable_note}</p>
      )}
      <div className="mt-3">
        {rentalOpen ? (
          <Link
            href={`/inicio/quadras/clube/${court.id}`}
            className="coach-listing-card__btn coach-listing-card__btn--primary inline-flex w-full justify-center"
          >
            Agendar
          </Link>
        ) : (
          <Link
            href={`/inicio/quadras/clube/${court.id}`}
            className="coach-listing-card__btn inline-flex w-full justify-center"
          >
            Ver detalhes
          </Link>
        )}
      </div>
    </div>
  );
}
