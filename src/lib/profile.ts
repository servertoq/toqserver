export type GenderType = "masculino" | "feminino" | "outro";

export type PlayerLevelType =
  | "iniciante"
  | "intermediario"
  | "avancado"
  | "profissional";

export type DominantHand = "direita" | "esquerda" | "ambidestra";
export type ExperienceBand = "lt1" | "y1_3" | "y3_5" | "y5_plus";
export type PlayFrequency = "x1" | "x2_3" | "x4_6" | "x7";
export type PlayStyle = "agressivo" | "defensivo" | "all_court" | "versatil";
export type FavoriteCourt = "rapida" | "saibro" | "grama" | "indoor";

export const PROFILE_BIO_MAX_LENGTH = 280;

export const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Prefiro não responder" },
];

export const PLAYER_LEVEL_OPTIONS: { value: PlayerLevelType; label: string }[] = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
  { value: "profissional", label: "Profissional" },
];

export function playerLevelLabel(level: PlayerLevelType) {
  return PLAYER_LEVEL_OPTIONS.find((opt) => opt.value === level)?.label ?? "Iniciante";
}

export const DOMINANT_HAND_OPTIONS: { value: DominantHand; label: string }[] = [
  { value: "direita", label: "Destra" },
  { value: "esquerda", label: "Canhota" },
  { value: "ambidestra", label: "Ambidestra" },
];

export const EXPERIENCE_BAND_OPTIONS: { value: ExperienceBand; label: string }[] = [
  { value: "lt1", label: "Menos de 1 ano" },
  { value: "y1_3", label: "1–3 anos" },
  { value: "y3_5", label: "3–5 anos" },
  { value: "y5_plus", label: "5+ anos" },
];

export const PLAY_FREQUENCY_OPTIONS: { value: PlayFrequency; label: string }[] = [
  { value: "x1", label: "1x por semana" },
  { value: "x2_3", label: "2–3x por semana" },
  { value: "x4_6", label: "4–6x por semana" },
  { value: "x7", label: "7x por semana" },
];

export const PLAY_STYLE_OPTIONS: { value: PlayStyle; label: string }[] = [
  { value: "agressivo", label: "Agressivo" },
  { value: "defensivo", label: "Defensivo" },
  { value: "all_court", label: "All court" },
  { value: "versatil", label: "Versátil" },
];

export const FAVORITE_COURT_OPTIONS: { value: FavoriteCourt; label: string }[] = [
  { value: "rapida", label: "Rápida" },
  { value: "saibro", label: "Saibro" },
  { value: "grama", label: "Grama" },
  { value: "indoor", label: "Indoor" },
];

function optionLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T | null | undefined
) {
  if (!value) return "—";
  return options.find((opt) => opt.value === value)?.label ?? "—";
}

export function dominantHandLabel(value: DominantHand | null | undefined) {
  return optionLabel(DOMINANT_HAND_OPTIONS, value);
}

export function experienceBandLabel(value: ExperienceBand | null | undefined) {
  return optionLabel(EXPERIENCE_BAND_OPTIONS, value);
}

export function playFrequencyLabel(value: PlayFrequency | null | undefined) {
  return optionLabel(PLAY_FREQUENCY_OPTIONS, value);
}

export function playStyleLabel(value: PlayStyle | null | undefined) {
  return optionLabel(PLAY_STYLE_OPTIONS, value);
}

export function favoriteCourtLabel(value: FavoriteCourt | null | undefined) {
  return optionLabel(FAVORITE_COURT_OPTIONS, value);
}

export function normalizeUsername(value: string) {
  return value.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return "O nome de usuário precisa ter pelo menos 3 caracteres.";
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return "Use apenas letras, números e underscore (_).";
  }
  return null;
}

export function formatUsernameAsName(username: string): string {
  return username
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function profileDisplayName(profile: {
  display_name?: string | null;
  username: string;
}): string {
  const trimmed = profile.display_name?.trim();
  if (trimmed) return trimmed;
  return formatUsernameAsName(profile.username);
}

/** Título da seção de resumo: "Sobre você" ou "Sobre Carla". */
export function profileAboutSectionTitle(
  profile: { display_name?: string | null; username: string },
  isOwnProfile: boolean
): string {
  if (isOwnProfile) return "Sobre você";
  const firstName = profileDisplayName(profile).split(/\s+/)[0];
  return `Sobre ${firstName}`;
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.length < 2) return "O nome deve ter pelo menos 2 caracteres.";
  if (trimmed.length > 60) return "O nome pode ter no máximo 60 caracteres.";
  return null;
}
