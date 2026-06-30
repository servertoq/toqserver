/** Normaliza CEP para comparação (só dígitos). */
export function normalizeCep(value: string) {
  return value.replace(/\D/g, "");
}

/** Texto sem acentos, minúsculo — melhora busca por cidade. */
function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export type LocationSearchFields = {
  name?: string | null;
  city?: string | null;
  cep?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  description?: string | null;
  formattedAddress?: string | null;
};

/**
 * Busca local por nome, cidade, CEP (com ou sem hífen), bairro, rua etc.
 */
export function matchesLocationSearch(query: string, fields: LocationSearchFields): boolean {
  const raw = query.trim();
  if (!raw) return true;

  const qNorm = normalizeSearchText(raw);
  const qCep = normalizeCep(raw);

  const textFields = [
    fields.name,
    fields.city,
    fields.neighborhood,
    fields.street,
    fields.description,
    fields.formattedAddress,
  ];

  for (const value of textFields) {
    if (!value) continue;
    if (normalizeSearchText(value).includes(qNorm)) return true;
  }

  if (qCep.length >= 3 && fields.cep) {
    const cepDigits = normalizeCep(fields.cep);
    if (cepDigits.includes(qCep)) return true;
  }

  return false;
}

export const LOCATION_SEARCH_PLACEHOLDER = "Buscar por nome, cidade ou CEP…";
