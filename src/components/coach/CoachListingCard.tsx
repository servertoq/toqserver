"use client";

import Image from "next/image";
import Link from "next/link";
import { coachContactUrl } from "@/lib/coachListings";
import { profilePath } from "@/lib/publicProfile";
import type { CoachListingWithProfile } from "@/types/coachListings";

type Props = {
  listing: CoachListingWithProfile;
  currentUserId: string;
  enrolled?: boolean;
  onEnroll?: (listing: CoachListingWithProfile) => void;
  onDelete?: (listing: CoachListingWithProfile) => void;
};

function CoachAvatar({
  username,
  avatarUrl,
}: {
  username: string;
  avatarUrl: string | null | undefined;
}) {
  const initial = username.charAt(0).toUpperCase() || "P";

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={56}
        height={56}
        className="coach-listing-card__avatar"
        unoptimized
      />
    );
  }

  return <div className="coach-listing-card__avatar coach-listing-card__avatar--fallback">{initial}</div>;
}

export function CoachListingCard({
  listing,
  currentUserId,
  enrolled = false,
  onEnroll,
  onDelete,
}: Props) {
  const isOwner = listing.user_id === currentUserId;
  const username = listing.profile?.username ?? "professor";
  const contactHref = coachContactUrl(listing.contact_whatsapp, listing.title, username);

  return (
    <article className={`coach-listing-card${isOwner ? " coach-listing-card--owner" : ""}`}>
      <div className="coach-listing-card__hero">
        <div className="coach-listing-card__hero-glow" aria-hidden />
        <div className="coach-listing-card__hero-pattern" aria-hidden />

        {isOwner && <span className="coach-listing-card__owner-badge">Sua divulgação</span>}

        <div className="coach-listing-card__professor">
          <CoachAvatar username={username} avatarUrl={listing.profile?.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="coach-listing-card__kicker">Aulas de tênis</p>
            <h2 className="coach-listing-card__title">{listing.title}</h2>
            {listing.profile && (
              <Link href={profilePath(listing.profile.username)} className="coach-listing-card__username">
                @{listing.profile.username}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="coach-listing-card__body">
        <p className="coach-listing-card__description">{listing.description}</p>

        <div className="coach-listing-card__price">
          <span className="coach-listing-card__price-value">{listing.price_label}</span>
          <span className="coach-listing-card__price-label">investimento</span>
        </div>

        {!isOwner && (
          <div className="coach-listing-card__actions">
            <a
              href={contactHref}
              target="_blank"
              rel="noopener noreferrer"
              className="coach-listing-card__btn coach-listing-card__btn--whatsapp"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>
            {enrolled ? (
              <span className="coach-listing-card__btn coach-listing-card__btn--enrolled">Inscrito</span>
            ) : (
              <button
                type="button"
                onClick={() => onEnroll?.(listing)}
                className="coach-listing-card__btn coach-listing-card__btn--primary"
              >
                Inscrever-se
              </button>
            )}
          </div>
        )}

        {isOwner && (
          <div className="coach-listing-card__actions coach-listing-card__actions--owner">
            <Link
              href={`/inicio/aprenda-a-jogar/${listing.id}/editar`}
              className="coach-listing-card__btn coach-listing-card__btn--primary"
            >
              Editar divulgação
            </Link>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(listing)}
                className="coach-listing-card__btn coach-listing-card__btn--danger"
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.855L0 24l6.335-1.662A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82a9.78 9.78 0 01-4.972-1.357l-.356-.212-3.756.986 1.003-3.66-.233-.375A9.78 9.78 0 012.18 12C2.18 6.57 6.57 2.18 12 2.18S21.82 6.57 21.82 12 17.43 21.82 12 21.82z" />
    </svg>
  );
}
