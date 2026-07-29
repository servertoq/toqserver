export const LEGAL_SITE = {
  brand: "Toq Tennis",
  brandShort: "TOQ",
  domain: "www.toqtennis.com.br",
  url: "https://www.toqtennis.com.br",
  contactEmail: "servertoq@gmail.com",
  instagramUrl: "https://www.instagram.com/toq.tennis/",
  instagramHandle: "@toq.tennis",
  whatsappDisplay: "(11) 94087-3795",
  whatsappUrl: "https://wa.me/5511940873795",
  /** Operador atual: pessoa física sob a marca Toq Tennis (sem CNPJ). */
  operatorLabel: "pessoa física responsável pela marca Toq Tennis",
  effectiveDate: "29 de julho de 2026",
  effectiveDateIso: "2026-07-29",
} as const;

export type LegalDocId =
  | "termos"
  | "privacidade"
  | "cookies"
  | "reembolso"
  | "seguranca";

export const LEGAL_NAV: { id: LegalDocId; href: string; label: string }[] = [
  { id: "termos", href: "/termos", label: "Termos de uso" },
  { id: "privacidade", href: "/privacidade", label: "Privacidade" },
  { id: "cookies", href: "/cookies", label: "Cookies" },
  { id: "reembolso", href: "/reembolso", label: "Reembolso" },
  { id: "seguranca", href: "/seguranca", label: "Segurança" },
];
