import { normalizePhoneDigits, whatsappUrl } from "@/lib/courts";

/** Aceita URL completa, instagram.com/user ou @user. */
export function normalizeInstagramUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return trimmed;
      const handle = url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      if (!handle || handle === "p" || handle === "reel" || handle === "stories") return trimmed;
      return `https://www.instagram.com/${handle}/`;
    }
  } catch {
    /* fall through */
  }

  const handle = trimmed
    .replace(/^@/, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!handle || !/^[A-Za-z0-9._]+$/.test(handle)) return null;
  return `https://www.instagram.com/${handle}/`;
}

export function instagramHandleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const handle = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return handle ? `@${handle}` : null;
  } catch {
    return null;
  }
}

export function formatClubWhatsappDisplay(phone: string) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone.trim();
}

export function clubWhatsappUrl(phone: string, clubName: string) {
  return whatsappUrl(phone, `Olá! Vi o clube "${clubName}" no Toq Tennis e gostaria de saber mais.`);
}

export type ClubContactFields = {
  instagram_url: string | null;
  contact_whatsapp: string | null;
};

export function parseClubContactInputs(
  instagram: string,
  whatsapp: string
): { ok: true; value: ClubContactFields } | { ok: false; error: string } {
  const igRaw = instagram.trim();
  const ig = normalizeInstagramUrl(instagram);
  if (igRaw && !ig) {
    return { ok: false, error: "Informe um @usuário ou link válido do Instagram." };
  }

  const digits = normalizePhoneDigits(whatsapp);
  if (whatsapp.trim() && digits.length < 10) {
    return { ok: false, error: "WhatsApp deve ter DDD + número (10 ou 11 dígitos)." };
  }

  return {
    ok: true,
    value: {
      instagram_url: ig,
      contact_whatsapp: digits.length >= 10 ? digits : null,
    },
  };
}

export function hasClubContact(contact: Partial<ClubContactFields>) {
  return Boolean(
    contact.instagram_url ||
      (contact.contact_whatsapp && contact.contact_whatsapp.replace(/\D/g, "").length >= 10)
  );
}
