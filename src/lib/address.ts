export type AddressFields = {
  zip: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  city: string;
  state: string;
};

export const EMPTY_ADDRESS: AddressFields = {
  zip: "",
  street: "",
  number: "",
  neighborhood: "",
  complement: "",
  city: "",
  state: "",
};

export function normalizeCep(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCepDisplay(cep: string): string {
  const d = normalizeCep(cep);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function addressFromRow(row: {
  address_zip?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_complement?: string | null;
  address_city?: string | null;
  address_state?: string | null;
}): AddressFields {
  return {
    zip: row.address_zip ?? "",
    street: row.address_street ?? "",
    number: row.address_number ?? "",
    neighborhood: row.address_neighborhood ?? "",
    complement: row.address_complement ?? "",
    city: row.address_city ?? "",
    state: row.address_state ?? "",
  };
}

export function addressToDbPayload(addr: AddressFields) {
  const zip = normalizeCep(addr.zip);
  const trim = (s: string) => s.trim() || null;
  const hasAny =
    zip ||
    addr.street.trim() ||
    addr.number.trim() ||
    addr.neighborhood.trim() ||
    addr.complement.trim() ||
    addr.city.trim() ||
    addr.state.trim();

  if (!hasAny) {
    return {
      address_zip: null,
      address_street: null,
      address_number: null,
      address_neighborhood: null,
      address_complement: null,
      address_city: null,
      address_state: null,
    };
  }

  return {
    address_zip: zip || null,
    address_street: trim(addr.street),
    address_number: trim(addr.number),
    address_neighborhood: trim(addr.neighborhood),
    address_complement: trim(addr.complement),
    address_city: trim(addr.city),
    address_state: (trim(addr.state) ?? "").toUpperCase().slice(0, 2) || null,
  };
}

export function hasAddress(addr: AddressFields): boolean {
  return Boolean(
    normalizeCep(addr.zip) ||
      addr.street.trim() ||
      addr.city.trim() ||
      addr.neighborhood.trim()
  );
}

export function formatAddressLines(addr: AddressFields): string[] {
  if (!hasAddress(addr)) return [];

  const lines: string[] = [];
  const streetLine = [addr.street.trim(), addr.number.trim()].filter(Boolean).join(", ");
  if (streetLine) lines.push(streetLine);

  const hood = addr.neighborhood.trim();
  if (hood) lines.push(hood);

  if (addr.complement.trim()) lines.push(addr.complement.trim());

  const cityState = [addr.city.trim(), addr.state.trim().toUpperCase()]
    .filter(Boolean)
    .join(" — ");
  const zip = normalizeCep(addr.zip);
  if (cityState || zip) {
    lines.push([cityState, zip ? `CEP ${formatCepDisplay(zip)}` : ""].filter(Boolean).join(" · "));
  }

  return lines;
}

export function formatAddressSingle(addr: AddressFields): string {
  return formatAddressLines(addr).join("\n");
}

type ViaCepResponse = {
  erro?: boolean;
  localidade?: string;
  uf?: string;
  logradouro?: string;
  bairro?: string;
};

export async function fetchAddressByCep(cep: string): Promise<{
  city: string;
  state: string;
  street: string;
  neighborhood: string;
} | null> {
  const digits = normalizeCep(cep);
  if (digits.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro) return null;

  return {
    city: data.localidade ?? "",
    state: data.uf ?? "",
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
  };
}
