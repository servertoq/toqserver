export type PersonaId = "player" | "coach" | "arena";

export type PersonaData = {
  id: PersonaId;
  label: string;
  title: string;
  description: string;
  highlights: string[];
};

export type PlatformFeature = {
  id: string;
  title: string;
  description: string;
};

export const AUTH_PERSONAS: PersonaData[] = [
  {
    id: "player",
    label: "Sou jogador",
    title: "Jogue mais. Evolua mais.",
    description: "Partidas, parceiros e desafios no seu nível — perto de você.",
    highlights: [
      "Match por nível e região",
      "Parceiros de treino e jogo",
      "Comunidades e torneios locais",
    ],
  },
  {
    id: "coach",
    label: "Sou professor",
    title: "Suas aulas com alcance.",
    description: "Ideal para quem dá aula de tênis e quer crescer com presença digital.",
    highlights: [
      "Divulgue aulas e metodologia",
      "Alcance alunos na sua cidade",
      "Reputação dentro da comunidade",
    ],
  },
  {
    id: "arena",
    label: "Tenho uma arena",
    title: "Sua quadra na vitrine.",
    description: "Para empresários que querem publicar arenas e atrair mais jogadores.",
    highlights: [
      "Publique quadras e horários",
      "Visibilidade com jogadores ativos",
      "Reservas no ecossistema TOQ",
    ],
  },
];

export type HowItWorksStep = {
  id: string;
  step: number;
  title: string;
  description: string;
};

export const AUTH_HOW_IT_WORKS: HowItWorksStep[] = [
  {
    id: "profile",
    step: 1,
    title: "Crie seu perfil",
    description: "Cadastre-se em minutos, defina seu nível e mostre quem você é no tênis.",
  },
  {
    id: "connect",
    step: 2,
    title: "Conecte-se",
    description: "Encontre jogadores, professores e arenas perto de você com match inteligente.",
  },
  {
    id: "play",
    step: 3,
    title: "Jogue e evolua",
    description: "Marque partidas, participe de comunidades e acompanhe sua evolução.",
  },
  {
    id: "grow",
    step: 4,
    title: "Cresça na rede",
    description: "Ganhe visibilidade, publique conteúdo e fortaleça sua presença no esporte.",
  },
];

export const AUTH_PLATFORM_FEATURES: PlatformFeature[] = [
  {
    id: "payment",
    title: "Pagamento garantido",
    description: "Experiência segura entre jogadores, professores e arenas.",
  },
  {
    id: "match",
    title: "Match inteligente",
    description: "Conexões por nível, perfil e proximidade geográfica.",
  },
  {
    id: "social",
    title: "Rede social",
    description: "Perfil, posts e mensagens feitos para quem vive o tênis.",
  },
  {
    id: "community",
    title: "Comunidade viva",
    description: "Clubes, eventos e conversas que movimentam a região.",
  },
  {
    id: "visibility",
    title: "Visibilidade real",
    description: "Seja encontrado por quem importa na sua cidade.",
  },
  {
    id: "arenas",
    title: "Arenas integradas",
    description: "Quadras publicadas com reservas e gestão simplificada.",
  },
];
