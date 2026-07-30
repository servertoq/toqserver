import {
  clubWhatsappUrl,
  formatClubWhatsappDisplay,
  hasClubContact,
  instagramHandleFromUrl,
  type ClubContactFields,
} from "@/lib/clubContact";

function IconInstagram({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconWhatsApp({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.89.5 3.73 1.44 5.35L2 22l4.89-1.53a9.86 9.86 0 0 0 5.15 1.44h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.78 14.09c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.16-4.93-4.35-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09.99-2.37.26-.28.57-.35.76-.35h.55c.18 0 .41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.12.56.16.28.73 1.2 1.57 1.94 1.08.96 1.99 1.26 2.27 1.4.28.14.44.12.6-.07.17-.19.7-.81.88-1.09.19-.28.37-.23.63-.14.26.09 1.66.78 1.95.92.28.14.47.21.54.33.07.12.07.7-.17 1.38Z" />
    </svg>
  );
}

type Props = {
  clubName: string;
  contact: ClubContactFields;
  className?: string;
};

export function ClubContactLinks({ clubName, contact, className = "" }: Props) {
  if (!hasClubContact(contact)) return null;

  const igLabel = instagramHandleFromUrl(contact.instagram_url) ?? "Instagram";
  const waDigits = contact.contact_whatsapp?.replace(/\D/g, "") ?? "";
  const showWa = waDigits.length >= 10;

  return (
    <div
      className={`rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)]/70 px-3 py-3 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
        Contato
      </p>
      <div className="mt-2.5 flex flex-col gap-2">
        {contact.instagram_url && (
          <a
            href={contact.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--toq-border)] bg-[var(--toq-input-bg)] px-3 py-2 text-xs font-semibold text-[var(--toq-navy)] transition hover:border-[var(--toq-accent)] hover:text-[var(--toq-accent)]"
          >
            <IconInstagram className="h-4 w-4 shrink-0 text-[var(--toq-accent)]" />
            <span className="min-w-0 truncate">{igLabel}</span>
          </a>
        )}
        {showWa && contact.contact_whatsapp && (
          <a
            href={clubWhatsappUrl(contact.contact_whatsapp, clubName)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366]/15 px-3 py-2 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/25"
          >
            <IconWhatsApp className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">
              {formatClubWhatsappDisplay(contact.contact_whatsapp)}
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
