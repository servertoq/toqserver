"use client";

import Link from "next/link";
import { coachContactUrl } from "@/lib/coachListings";
import type { CoachListingWithProfile } from "@/types/coachListings";

type Props = {
  listing: CoachListingWithProfile;
  currentUserId: string;
  onDelete?: (listing: CoachListingWithProfile) => void;
};

export function CoachListingCard({ listing, currentUserId, onDelete }: Props) {
  const isOwner = listing.user_id === currentUserId;
  const username = listing.profile?.username ?? "professor";
  const contactHref = coachContactUrl(listing.contact_whatsapp, listing.title, username);

  return (
    <article className="flex h-full flex-col overflow-hidden toq-card-lg">
      <div className="bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-accent)] px-4 py-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">Professor de tênis</p>
        <h2 className="mt-1 text-lg font-bold text-white">{listing.title}</h2>
        {listing.profile && (
          <p className="mt-2 text-xs font-medium text-white/90">@{listing.profile.username}</p>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-4 flex-1 text-sm leading-relaxed text-[var(--toq-text-muted)]">
          {listing.description}
        </p>

        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-900">Valor</p>
          <p className="mt-0.5 text-sm font-semibold text-emerald-950">{listing.price_label}</p>
        </div>

        {!isOwner && (
          <a
            href={contactHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1ebe5d]"
          >
            Entrar em contato
          </a>
        )}

        {isOwner && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/inicio/aprenda-a-jogar/${listing.id}/editar`}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-[var(--toq-navy)] hover:border-[var(--toq-accent)]"
            >
              Editar
            </Link>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(listing)}
                className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Excluir
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
