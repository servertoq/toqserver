export type GenderType = "masculino" | "feminino" | "outro";

export const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
];

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
