import type { Court, CourtFormData, CourtWithOwner } from "@/types/courts";
import { COURT_SIZE_OPTIONS } from "@/types/courts";

export function courtSizeLabel(value: string) {
  return COURT_SIZE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function formatCourtAddress(court: Pick<Court, "street" | "street_number" | "neighborhood" | "city" | "state" | "cep">) {
  const parts: string[] = [];
  if (court.street) {
    let line = court.street;
    if (court.street_number) line += `, ${court.street_number}`;
    parts.push(line);
  }
  if (court.neighborhood) parts.push(court.neighborhood);
  if (court.city && court.state) parts.push(`${court.city} - ${court.state}`);
  if (court.cep) parts.push(`CEP ${formatCep(court.cep)}`);
  return parts.join(" · ") || "Endereço não informado";
}

export function formatCep(cep: string) {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return cep;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function normalizePhoneDigits(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits;
}

/** Máscara enquanto digita: 0900 → 09:00 */
export function formatTimeInputAsTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Aceita 09:00, 0900 ou 9:00 e retorna minutos desde meia-noite. */
export function parseTimeInputToMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let h: number;
  let m: number;

  if (trimmed.includes(":")) {
    const [hs, ms] = trimmed.split(":");
    if (!hs || ms === undefined) return null;
    h = parseInt(hs, 10);
    m = parseInt(ms, 10);
  } else {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 3 || digits.length > 4) return null;
    h = parseInt(digits.slice(0, digits.length - 2), 10);
    m = parseInt(digits.slice(-2), 10);
  }

  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function formatMinutesAsTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutesToTimeInput(raw: string, deltaMinutes: number): string {
  const base = parseTimeInputToMinutes(raw);
  if (base === null) return raw;
  return formatMinutesAsTimeInput(base + deltaMinutes);
}

export function whatsappUrl(phone: string, message?: string) {
  const digits = normalizePhoneDigits(phone);
  const base = `https://wa.me/55${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export async function fetchAddressByCep(cep: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  error?: string;
}> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) {
    return { street: "", neighborhood: "", city: "", state: "", error: "CEP deve ter 8 dígitos." };
  }

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) {
    return { street: "", neighborhood: "", city: "", state: "", error: "Não foi possível consultar o CEP." };
  }

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro) {
    return { street: "", neighborhood: "", city: "", state: "", error: "CEP não encontrado." };
  }

  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: (data.uf ?? "").toUpperCase(),
  };
}

export function courtToFormData(court: Court): CourtFormData {
  const sizeMatch = COURT_SIZE_OPTIONS.find((o) => o.label === court.size_label);
  return {
    name: court.name,
    size_label: sizeMatch?.value ?? court.size_label,
    description: court.description,
    cep: court.cep ?? "",
    street: court.street ?? "",
    street_number: court.street_number ?? "",
    complement: court.complement ?? "",
    neighborhood: court.neighborhood ?? "",
    city: court.city,
    state: court.state,
    latitude: court.latitude,
    longitude: court.longitude,
    formatted_address: court.formatted_address ?? "",
    contact_phone: court.contact_phone,
  };
}

export function formDataToInsert(
  data: CourtFormData,
  ownerId: string
): Omit<Court, "id" | "created_at" | "updated_at" | "country"> & { owner_id: string; country: string } {
  const sizeLabel = courtSizeLabel(data.size_label);
  return {
    owner_id: ownerId,
    name: data.name.trim(),
    size_label: sizeLabel,
    description: data.description.trim(),
    cep: data.cep.replace(/\D/g, "") || null,
    street: data.street.trim() || null,
    street_number: data.street_number.trim() || null,
    complement: data.complement.trim() || null,
    neighborhood: data.neighborhood.trim() || null,
    city: data.city.trim(),
    state: data.state.trim().toUpperCase().slice(0, 2),
    country: "Brasil",
    latitude: data.latitude,
    longitude: data.longitude,
    formatted_address: data.formatted_address.trim() || buildFormattedAddress(data),
    contact_phone: normalizePhoneDigits(data.contact_phone),
  };
}

function buildFormattedAddress(data: CourtFormData) {
  const parts: string[] = [];
  if (data.street) {
    let line = data.street;
    if (data.street_number) line += `, ${data.street_number}`;
    parts.push(line);
  }
  if (data.neighborhood) parts.push(data.neighborhood);
  if (data.city && data.state) parts.push(`${data.city} - ${data.state}`);
  if (data.cep) parts.push(formatCep(data.cep));
  return parts.join(", ");
}

export function mapCourtRow(
  row: Court & { owner?: CourtWithOwner["owner"] | CourtWithOwner["owner"][] }
): CourtWithOwner {
  const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
  const { owner: _o, ...court } = row;
  return { ...court, owner };
}

export const emptyCourtForm = (): CourtFormData => ({
  name: "",
  size_label: "individual",
  description: "",
  cep: "",
  street: "",
  street_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  latitude: null,
  longitude: null,
  formatted_address: "",
  contact_phone: "",
});
