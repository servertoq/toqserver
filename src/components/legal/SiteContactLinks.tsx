import { LEGAL_SITE } from "@/lib/legal/site";

type Props = {
  className?: string;
  /** `row` = botões horizontais; `stack` = lista vertical com rótulo */
  variant?: "row" | "stack";
};

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
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.96.52 3.8 1.44 5.4L2 22l4.95-1.55a9.9 9.9 0 0 0 5.09 1.38h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2Zm5.77 13.95c-.24.67-1.4 1.23-1.93 1.31-.5.07-1.13.1-1.83-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.93-4.36-.14-.19-1.17-1.55-1.17-2.96 0-1.4.74-2.09 1-2.37.26-.28.57-.35.76-.35h.55c.18 0 .42-.07.65.5.24.58.8 2 .87 2.14.07.14.12.3.02.49-.1.19-.14.3-.28.47-.14.16-.3.36-.42.49-.14.14-.28.29-.12.56.16.28.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.67-.78.85-1.05.18-.27.36-.22.6-.13.25.09 1.57.74 1.84.87.27.14.45.2.52.31.07.11.07.64-.17 1.31Z" />
    </svg>
  );
}

function IconEmail({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M4.5 7.5 12 12.5l7.5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CONTACTS = [
  {
    key: "instagram",
    href: LEGAL_SITE.instagramUrl,
    external: true,
    label: "Instagram",
    value: LEGAL_SITE.instagramHandle,
    Icon: IconInstagram,
    tone: "instagram" as const,
  },
  {
    key: "whatsapp",
    href: LEGAL_SITE.whatsappUrl,
    external: true,
    label: "WhatsApp",
    value: LEGAL_SITE.whatsappDisplay,
    Icon: IconWhatsApp,
    tone: "whatsapp" as const,
  },
  {
    key: "email",
    href: `mailto:${LEGAL_SITE.contactEmail}`,
    external: false,
    label: "E-mail",
    value: LEGAL_SITE.contactEmail,
    Icon: IconEmail,
    tone: "email" as const,
  },
];

export function SiteContactLinks({ className = "", variant = "stack" }: Props) {
  return (
    <ul
      className={`site-contact-links site-contact-links--${variant} ${className}`.trim()}
      aria-label="Contatos"
    >
      {CONTACTS.map(({ key, href, external, label, value, Icon, tone }) => (
        <li key={key}>
          <a
            href={href}
            className={`site-contact-links__item site-contact-links__item--${tone}`}
            title={`${label} ${value}`}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <span className="site-contact-links__icon-wrap" aria-hidden>
              <Icon className="site-contact-links__icon" />
            </span>
            <span className="site-contact-links__copy">
              <span className="site-contact-links__label">{label}</span>
              <span className="site-contact-links__value">{value}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
