/** Nome do estado (PT) → UF. */
const STATE_NAME_TO_UF: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function normalizeStateKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Converte código ISO (BR-MT), UF ou nome do estado em UF de 2 letras. */
export function toBrazilUf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withoutCountry = trimmed.replace(/^BR-/i, "").trim();
  if (/^[A-Za-z]{2}$/.test(withoutCountry)) {
    const uf = withoutCountry.toUpperCase();
    // "BR" é país, não UF
    if (uf === "BR") return null;
    return uf;
  }

  return STATE_NAME_TO_UF[normalizeStateKey(withoutCountry)] ?? null;
}
