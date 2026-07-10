"use client";

import Link from "next/link";
import { coachContactUrl, formatCoachWhatsappDisplay } from "@/lib/coachListings";
import type { FeedCoachListing } from "@/types/feed";

type Props = {
  listing: FeedCoachListing;
  coachUsername: string;
  enrolled?: boolean;
  onEnroll?: () => void;
};

export function CoachListingPostActions({
  listing,
  coachUsername,
  enrolled = false,
  onEnroll,
}: Props) {
  const contactHref = coachContactUrl(listing.contact_whatsapp, listing.title, coachUsername);
  const contactLabel = formatCoachWhatsappDisplay(listing.contact_whatsapp);

  return (
    <div className="coach-listing-post-actions mt-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
        Contato do professor
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--toq-navy)]">{contactLabel}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={contactHref}
          target="_blank"
          rel="noopener noreferrer"
          className="coach-listing-card__btn coach-listing-card__btn--whatsapp inline-flex min-w-0 flex-1 justify-center"
        >
          <WhatsAppIcon />
          WhatsApp
        </a>
        {enrolled ? (
          <span className="coach-listing-card__btn coach-listing-card__btn--enrolled inline-flex min-w-0 flex-1 justify-center">
            Inscrito
          </span>
        ) : onEnroll ? (
          <button
            type="button"
            onClick={onEnroll}
            className="coach-listing-card__btn coach-listing-card__btn--primary inline-flex min-w-0 flex-1 justify-center"
          >
            Inscrever-se
          </button>
        ) : (
          <Link
            href="/inicio/aprenda-a-jogar"
            className="coach-listing-card__btn coach-listing-card__btn--primary inline-flex min-w-0 flex-1 justify-center"
          >
            Inscrever-se
          </Link>
        )}
      </div>
    </div>
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
