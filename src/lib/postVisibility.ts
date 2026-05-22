import type { PostVisibility } from "@/types/feed";

export type PostContext = "global" | "community";

export function visibilityOptions(context: PostContext): {
  value: PostVisibility;
  label: string;
  hint: string;
}[] {
  if (context === "community") {
    return [
      {
        value: "private",
        label: "Privado",
        hint: "Somente membros da comunidade veem",
      },
      {
        value: "public",
        label: "Público",
        hint: "Membros veem aqui e também no feed geral",
      },
    ];
  }

  return [
    {
      value: "public",
      label: "Público",
      hint: "Todos os usuários podem ver",
    },
    {
      value: "private",
      label: "Privado",
      hint: "Somente quem te adicionou como amigo",
    },
  ];
}

export function visibilityBadgeLabel(
  visibility: PostVisibility,
  inCommunity: boolean
): string | null {
  if (inCommunity && visibility === "public") return "Também no feed geral";
  if (!inCommunity && visibility === "private") return "Privado · amigos";
  if (inCommunity && visibility === "private") return "Só membros";
  return null;
}
