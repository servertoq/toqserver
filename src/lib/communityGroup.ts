import type { CommunityGroupKind } from "@/types/community";

export type { CommunityGroupKind };

export type CommunityGroupConfig = {
  kind: CommunityGroupKind;
  basePath: string;
  listTitle: string;
  listSubtitle: string;
  createHref: string;
  createTitle: string;
  createButton: string;
  backLabel: string;
  notFound: string;
  emptyList: string;
  searchPlaceholder: string;
  feedTitle: string;
  memberOnlyFeed: string;
  joinPublic: string;
  joinPrivate: string;
  leaveConfirm: string;
  fullLabel: string;
  pendingRequest: string;
};

export const COMMUNITY_GROUP_CONFIG: Record<CommunityGroupKind, CommunityGroupConfig> = {
  community: {
    kind: "community",
    basePath: "/inicio/comunidade",
    listTitle: "Comunidades",
    listSubtitle: "Descubra grupos, entre nas públicas ou solicite acesso às privadas.",
    createHref: "/inicio/comunidade/criar",
    createTitle: "Nova comunidade",
    createButton: "Criar comunidade",
    backLabel: "Comunidades",
    notFound: "Comunidade não encontrada.",
    emptyList: "Nenhuma comunidade encontrada.",
    searchPlaceholder: "Buscar comunidades…",
    feedTitle: "Feed da comunidade",
    memberOnlyFeed: "Feed exclusivo para membros",
    joinPublic: "Entrar na comunidade",
    joinPrivate: "Solicitar entrada",
    leaveConfirm: "Sair desta comunidade?",
    fullLabel: "Comunidade cheia.",
    pendingRequest: "Pedido de entrada enviado — aguarde aprovação.",
  },
  club: {
    kind: "club",
    basePath: "/inicio/clubes",
    listTitle: "Clubes",
    listSubtitle:
      "Grupos privados: só membros veem posts e eventos. Entrada com aprovação ou convite.",
    createHref: "/inicio/clubes/criar",
    createTitle: "Novo clube",
    createButton: "Criar clube",
    backLabel: "Clubes",
    notFound: "Clube não encontrado ou você não tem acesso.",
    emptyList: "Você ainda não participa de nenhum clube. Crie um ou aguarde um convite.",
    searchPlaceholder: "Buscar por nome, cidade ou CEP…",
    feedTitle: "Feed do clube",
    memberOnlyFeed: "Conteúdo exclusivo para membros do clube",
    joinPublic: "Solicitar entrada",
    joinPrivate: "Solicitar entrada",
    leaveConfirm: "Sair deste clube?",
    fullLabel: "Clube cheio.",
    pendingRequest: "Pedido enviado — aguarde aprovação do administrador.",
  },
};

export function groupDetailHref(kind: CommunityGroupKind, slug: string) {
  return `${COMMUNITY_GROUP_CONFIG[kind].basePath}/${slug}`;
}
