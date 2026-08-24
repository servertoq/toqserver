import type { PlayerLevelType } from "@/lib/profile";

export type DominantHand = "direita" | "esquerda" | "ambidestra";
export type ExperienceBand = "lt1" | "y1_3" | "y3_5" | "y5_plus";
export type PlayFrequency = "x1" | "x2_3" | "x4_6" | "x7";
export type PlayStyle = "agressivo" | "defensivo" | "all_court" | "versatil";
export type FavoriteCourt = "rapida" | "saibro" | "grama" | "indoor";

export type ProfileGameAttrs = {
  player_level: PlayerLevelType;
  dominant_hand: DominantHand | null;
  experience_band: ExperienceBand | null;
  play_frequency: PlayFrequency | null;
  play_style: PlayStyle | null;
  favorite_court: FavoriteCourt | null;
};

export const DOMINANT_HAND_OPTIONS: { value: DominantHand; label: string }[] = [
  { value: "direita", label: "Destra" },
  { value: "esquerda", label: "Canhota" },
  { value: "ambidestra", label: "Ambidestra" },
];

export const EXPERIENCE_BAND_OPTIONS: { value: ExperienceBand; label: string }[] = [
  { value: "lt1", label: "Menos de 1 ano" },
  { value: "y1_3", label: "1–3 anos" },
  { value: "y3_5", label: "3–5 anos" },
  { value: "y5_plus", label: "Mais de 5 anos" },
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
  { value: "all_court", label: "All-court" },
  { value: "versatil", label: "Versátil" },
];

export const FAVORITE_COURT_OPTIONS: { value: FavoriteCourt; label: string }[] = [
  { value: "rapida", label: "Rápida" },
  { value: "saibro", label: "Saibro" },
  { value: "grama", label: "Grama" },
  { value: "indoor", label: "Indoor" },
];

function labelOf<T extends string>(
  options: { value: T; label: string }[],
  value: T | null | undefined,
  fallback = "—"
) {
  if (!value) return fallback;
  return options.find((o) => o.value === value)?.label ?? fallback;
}

export function dominantHandLabel(v: DominantHand | null | undefined) {
  return labelOf(DOMINANT_HAND_OPTIONS, v);
}

export function experienceBandLabel(v: ExperienceBand | null | undefined) {
  return labelOf(EXPERIENCE_BAND_OPTIONS, v);
}

export function playFrequencyLabel(v: PlayFrequency | null | undefined) {
  return labelOf(PLAY_FREQUENCY_OPTIONS, v);
}

export function playStyleLabel(v: PlayStyle | null | undefined) {
  return labelOf(PLAY_STYLE_OPTIONS, v);
}

export function favoriteCourtLabel(v: FavoriteCourt | null | undefined) {
  return labelOf(FAVORITE_COURT_OPTIONS, v);
}
