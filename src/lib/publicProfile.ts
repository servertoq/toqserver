import type { GenderType } from "@/lib/profile";

export function genderLabel(gender: GenderType) {
  if (gender === "masculino") return "Masculino";
  if (gender === "feminino") return "Feminino";
  return "Outro";
}

export function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function formatAge(birthDate: string) {
  const birth = new Date(birthDate + "T12:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function profilePath(username: string) {
  return `/inicio/jogador/${encodeURIComponent(username)}`;
}
