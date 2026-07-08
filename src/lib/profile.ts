export type GenderType = "masculino" | "feminino" | "outro";

export type PlayerLevelType =
  | "iniciante"
  | "intermediario"
  | "avancado"
  | "profissional";

export const PROFILE_BIO_MAX_LENGTH = 280;

export const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
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
