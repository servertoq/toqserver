export type Court = {
  id: string;
  owner_id: string;
  name: string;
  size_label: string;
  description: string;
  cep: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  contact_phone: string;
  created_at: string;
  updated_at: string;
};

export type CourtWithOwner = Court & {
  owner?: { id: string; username: string; avatar_url: string | null };
};

export type CourtFormData = {
  name: string;
  size_label: string;
  description: string;
  cep: string;
  street: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string;
  contact_phone: string;
};

export const COURT_SIZE_OPTIONS = [
  { value: "individual", label: "Individual (6,40m × 10,97m)" },
  { value: "dupla", label: "Dupla (10,97m × 23,77m)" },
  { value: "beach_tennis", label: "Beach tennis (16m × 8m)" },
  { value: "padel", label: "Padel (20m × 10m)" },
  { value: "outro", label: "Outro (descreva na descrição)" },
] as const;
