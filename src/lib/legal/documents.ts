import { LEGAL_SITE, type LegalDocId } from "./site";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  description: string;
  sections: LegalSection[];
};

const disclaimer = `Este documento é um modelo informativo em português. Não substitui aconselhamento jurídico. Em caso de dúvida, consulte um advogado. Contato: ${LEGAL_SITE.contactEmail}.`;

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  termos: {
    id: "termos",
    title: "Termos de uso",
    description: `Condições gerais de uso da plataforma ${LEGAL_SITE.brand}.`,
    sections: [
      {
        heading: "1. Quem somos",
        paragraphs: [
          `A plataforma ${LEGAL_SITE.brand} (“${LEGAL_SITE.brandShort}”, “nós”, “nosso”), disponível em ${LEGAL_SITE.domain}, é operada por ${LEGAL_SITE.operatorLabel}.`,
          `Ao criar uma conta ou usar o serviço, você concorda com estes Termos e com a Política de Privacidade, que descreve o tratamento de dados pessoais nos termos da LGPD (Lei nº 13.709/2018).`,
          disclaimer,
        ],
      },
      {
        heading: "2. O serviço",
        paragraphs: [
          `${LEGAL_SITE.brand} é uma rede social e plataforma voltada ao tênis: feed, comunidades, quadras, aulas, perfil, mensagens e planos pagos opcionais.`,
          "Podemos alterar, suspender ou descontinuar funcionalidades mediante aviso razoável quando possível.",
        ],
      },
      {
        heading: "3. Conta e elegibilidade",
        paragraphs: [
          "Você deve fornecer informações verdadeiras, manter a segurança da senha e não compartilhar o acesso.",
          "É necessário ter idade mínima de 16 anos para se cadastrar. Menores de 18 anos devem ter consentimento dos responsáveis legais quando a lei exigir.",
          "Reservamo-nos o direito de recusar, suspender ou encerrar contas em caso de violação destes Termos, fraude, abuso ou risco à comunidade.",
        ],
      },
      {
        heading: "4. Conteúdo do usuário",
        paragraphs: [
          "Você mantém os direitos sobre o conteúdo que publica (textos, imagens, anúncios etc.), e nos concede licença não exclusiva para exibi-lo na plataforma.",
          "É proibido publicar conteúdo ilegal, ofensivo, discriminatório, que viole direitos de terceiros, spam, malware ou que explore menores.",
          "Podemos remover conteúdo e aplicar sanções (incluindo banimento) conforme nossas regras de moderação.",
        ],
      },
      {
        heading: "5. Planos e pagamentos",
        paragraphs: [
          "Há um plano gratuito e planos pagos (Professor, Promotor, Proprietário e variantes), cada um válido por 30 dias. Pagamentos são processados pelo Mercado Pago (Pix e cartão). Cartão pode ser avulso ou com renovação automática; Pix exige renovação manual. Sem renovação/pagamento, as funções do plano são desligadas ao vencer.",
          "Nos primeiros 15 dias do ciclo, upgrade para um plano superior cobra apenas a diferença de preço. Após 15 dias, o upgrade cobra o valor integral do novo plano (novo ciclo de 30 dias). Renovação antecipada soma 30 dias ao que ainda resta de validade.",
          "Preços e benefícios podem mudar; alterações valem para novas cobranças após a divulgação.",
          "Regras de reembolso estão em nossa Política de Reembolso.",
        ],
      },
      {
        heading: "6. Conduta e uso aceitável",
        paragraphs: [
          "Você concorda em não: tentar acessar áreas não autorizadas; interferir no funcionamento do serviço; coletar dados de outros usuários sem base legal; usar bots abusivos; ou praticar engenharia social.",
        ],
        bullets: [
          "Respeitar outros usuários, professores e gestores de arenas",
          "Não se passar por outra pessoa ou entidade",
          "Não usar a plataforma para atividades ilícitas",
        ],
      },
      {
        heading: "7. Propriedade intelectual",
        paragraphs: [
          `Marca, layout, código e materiais da ${LEGAL_SITE.brand} pertencem a nós ou a licenciadores. Uso não autorizado é vedado.`,
        ],
      },
      {
        heading: "8. Limitação de responsabilidade",
        paragraphs: [
          "O serviço é oferecido “como está”, dentro dos limites da lei. Não garantimos disponibilidade ininterrupta nem resultados específicos de partidas, aulas ou negócios entre usuários.",
          "Interações e contratos entre usuários (ex.: aulas, aluguel de quadras) são de responsabilidade das partes envolvidas, salvo quando a lei imponha obrigação diversa.",
        ],
      },
      {
        heading: "9. Alterações e contato",
        paragraphs: [
          `Podemos atualizar estes Termos. A data de vigência será atualizada nesta página. Dúvidas: ${LEGAL_SITE.contactEmail}.`,
        ],
      },
    ],
  },

  privacidade: {
    id: "privacidade",
    title: "Política de privacidade",
    description: `Como a ${LEGAL_SITE.brand} trata dados pessoais sob a LGPD.`,
    sections: [
      {
        heading: "1. Controlador e contato",
        paragraphs: [
          `O controlador dos dados é ${LEGAL_SITE.operatorLabel}, responsável pela plataforma ${LEGAL_SITE.brand} (${LEGAL_SITE.domain}).`,
          `Para exercer direitos LGPD ou tirar dúvidas: ${LEGAL_SITE.contactEmail}.`,
          disclaimer,
        ],
      },
      {
        heading: "2. Quais dados coletamos",
        paragraphs: ["Dependendo do uso, podemos tratar:"],
        bullets: [
          "Cadastro: e-mail, senha (hash), nome de usuário, data de nascimento, sexo/gênero (se informado), foto de perfil",
          "Perfil e uso: posts, comentários, comunidades, mensagens, preferências (ex.: tema claro/escuro), cidade/UF do perfil",
          "Localização: coordenadas do dispositivo (GPS) quando você autoriza no navegador — para preencher cidade no perfil, ordenar conteúdo “perto de mim” e recursos de mapas; a permissão pode ser revogada a qualquer momento nas configurações do navegador",
          "Reservas de quadra: data/horário, quadra, clube, status da reserva, usuário que reservou e jogadores convidados (até 3), espelhados na agenda/partidas do perfil quando aplicável",
          "Pagamentos: dados de cobrança processados pelo Mercado Pago (Pix e cartão; nós não armazenamos número completo de cartão)",
          "Mapas: Google Maps ao cadastrar ou visualizar quadras, quando o recurso for utilizado",
          "Dados técnicos: IP, tipo de dispositivo/navegador, logs de segurança e cookies essenciais",
          "Login social: dados fornecidos pelo Google OAuth quando você escolhe essa opção",
        ],
      },
      {
        heading: "3. Finalidades e bases legais",
        paragraphs: [
          "Tratamos dados para: prestar o serviço; autenticar contas; personalizar a experiência (incluindo proximidade geográfica quando autorizado); processar upgrades de plano; gerenciar reservas e agendas; moderar a comunidade; cumprir obrigações legais; e melhorar segurança e estabilidade.",
          "Bases típicas (LGPD): execução de contrato (art. 7º, V) para cadastro e uso da plataforma; legítimo interesse (art. 7º, IX) quando aplicável (ex.: segurança e prevenção a fraudes); consentimento (art. 7º, I) quando exigido (ex.: cookies não essenciais e uso de GPS do dispositivo); e cumprimento de obrigação legal.",
          "O consentimento para localização do dispositivo é específico e pode ser retirado a qualquer momento, sem prejuízo do uso das demais funções que não dependam de GPS.",
        ],
      },
      {
        heading: "4. Compartilhamento e operadores",
        paragraphs: [
          "Usamos prestadores que tratam dados em nosso nome ou como controladores independentes, conforme o caso:",
        ],
        bullets: [
          "Supabase — autenticação, banco de dados e armazenamento de arquivos",
          "Mercado Pago — processamento de pagamentos (Pix, cartão e assinaturas)",
          "Google — login OAuth e Maps (quando usados)",
          "Vercel e Cloudflare — hospedagem, CDN e proteção do site",
          "Resend — envio de e-mails transacionais de autenticação (quando configurado)",
        ],
      },
      {
        heading: "5. Transferências internacionais",
        paragraphs: [
          "Alguns provedores podem processar dados fora do Brasil. Nesses casos, buscamos salvaguardas adequadas previstas na LGPD e nas políticas desses fornecedores.",
        ],
      },
      {
        heading: "6. Retenção",
        paragraphs: [
          "Mantemos dados enquanto a conta estiver ativa e pelo tempo necessário às finalidades, obrigações legais, defesa em disputas ou segurança. Após exclusão de conta, removemos ou anonimizamos dados pessoais quando viável, salvo retenção legal.",
        ],
      },
      {
        heading: "7. Seus direitos (LGPD)",
        paragraphs: [
          "Nos termos da LGPD, você pode solicitar: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade; portabilidade; informação sobre compartilhamentos; informação sobre a possibilidade de não consentir e as consequências; e revogação do consentimento.",
          `Para exercer direitos, escreva para ${LEGAL_SITE.contactEmail} com o e-mail da conta. Podemos pedir confirmação de identidade. Responderemos em prazo razoável, observados os prazos legais.`,
        ],
      },
      {
        heading: "8. Segurança",
        paragraphs: [
          "Adotamos medidas técnicas e organizacionais razoáveis (HTTPS, controles de acesso, práticas de hospedagem). Nenhum sistema é 100% seguro; reporte incidentes suspeitos ao contato acima.",
          "Detalhes adicionais em nossa página de Segurança.",
        ],
      },
      {
        heading: "9. Menores",
        paragraphs: [
          "O serviço não é direcionado a crianças menores de 16 anos. Se tomarmos conhecimento de cadastro indevido, poderemos remover a conta.",
        ],
      },
      {
        heading: "10. Alterações",
        paragraphs: [
          `Esta política pode ser atualizada. A data de vigência consta no topo da página. Contato: ${LEGAL_SITE.contactEmail}.`,
        ],
      },
    ],
  },

  cookies: {
    id: "cookies",
    title: "Política de cookies",
    description: "Como usamos cookies e tecnologias similares.",
    sections: [
      {
        heading: "1. O que são cookies",
        paragraphs: [
          "Cookies são pequenos arquivos armazenados no seu dispositivo. Também usamos armazenamento local (localStorage) para preferências e consentimento.",
          disclaimer,
        ],
      },
      {
        heading: "2. Tipos que utilizamos",
        paragraphs: ["Na versão atual da plataforma:"],
        bullets: [
          "Essenciais: sessão de autenticação (Supabase), segurança e funcionamento básico do site",
          "Preferências: tema (claro/escuro/sistema) e registro da sua escolha neste banner de cookies (LGPD)",
          "Localização: quando você autoriza o GPS no navegador, as coordenadas podem ser usadas na sessão para cidade do perfil e recursos de proximidade; isso depende da permissão do dispositivo, não de cookie de publicidade",
          "Não utilizamos, no momento, cookies de publicidade de terceiros ou redes de anúncios",
        ],
      },
      {
        heading: "3. Base legal e escolha",
        paragraphs: [
          "Cookies essenciais são necessários ao serviço (execução de contrato / legítimo interesse, conforme o caso).",
          "Preferências e cookies não essenciais dependem do seu consentimento (LGPD, art. 7º, I), quando aplicável.",
          "Você pode aceitar ou recusar cookies não essenciais neste banner. Recusar não impede o uso das funções essenciais.",
          "Também é possível limpar cookies/armazenamento pelo navegador; isso pode desconectar a sessão.",
        ],
      },
      {
        heading: "4. Terceiros",
        paragraphs: [
          "Ao usar Google Login, Google Maps ou Mercado Pago, esses serviços podem definir cookies próprios conforme suas políticas.",
        ],
      },
      {
        heading: "5. Contato",
        paragraphs: [`Dúvidas: ${LEGAL_SITE.contactEmail}.`],
      },
    ],
  },

  reembolso: {
    id: "reembolso",
    title: "Política de reembolso e devolução",
    description: "Regras para cobranças de upgrade de planos na Toq Tennis.",
    sections: [
      {
        heading: "1. O que cobramos",
        paragraphs: [
          `Na ${LEGAL_SITE.brand}, planos pagos têm ciclo de 30 dias. Cobranças (Pix, cartão avulso ou recorrente) são processadas pelo Mercado Pago. Sem renovação, o plano é desativado automaticamente ao vencer.`,
          disclaimer,
        ],
      },
      {
        heading: "2. Direito de arrependimento (CDC)",
        paragraphs: [
          "Se você for consumidor e a compra for feita fora do estabelecimento físico (online), a legislação brasileira pode assegurar o direito de arrependimento em até 7 dias corridos a contar da contratação/pagamento, nos termos do Código de Defesa do Consumidor, quando aplicável.",
          `Para solicitar, envie e-mail a ${LEGAL_SITE.contactEmail} com: e-mail da conta, data do pagamento e motivo. Analisaremos e responderemos em prazo razoável.`,
        ],
      },
      {
        heading: "3. Outros casos de reembolso",
        paragraphs: [
          "Podemos avaliar reembolso parcial ou total em caso de cobrança duplicada, falha técnica comprovada do nosso lado, ou upgrade não liberado após pagamento confirmado.",
          "Não reembolsamos, em regra, pelo simples desuso do plano após o período de arrependimento, nem por insatisfação subjetiva sem falha do serviço, salvo obrigação legal.",
        ],
      },
      {
        heading: "4. Como o estorno é feito",
        paragraphs: [
          "Estornos aprovados são processados via Mercado Pago, no mesmo meio de pagamento quando possível. O prazo de crédito na fatura/conta depende do banco, cartão ou provedor Pix.",
          "Após reembolso integral por arrependimento, o plano poderá retornar ao estado anterior.",
        ],
      },
      {
        heading: "5. Contato",
        paragraphs: [`Solicitações e dúvidas: ${LEGAL_SITE.contactEmail}.`],
      },
    ],
  },

  seguranca: {
    id: "seguranca",
    title: "Segurança",
    description: "Práticas de segurança e recomendações aos usuários.",
    sections: [
      {
        heading: "1. Medidas que adotamos",
        paragraphs: [
          `A ${LEGAL_SITE.brand} busca proteger a plataforma e os dados com medidas razoáveis, incluindo:`,
        ],
        bullets: [
          "Conexões HTTPS e infraestrutura atrás de CDN/proxy (Cloudflare) quando em produção",
          "Cabeçalhos de segurança HTTP (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS)",
          "Autenticação e banco gerenciados por provedores especializados (Supabase)",
          "Pagamentos processados pelo Mercado Pago (dados sensíveis de cartão não ficam em nossos servidores)",
          "Controles de acesso e regras no servidor para funções sensíveis (ex.: banimento, planos)",
        ],
      },
      {
        heading: "2. O que pedimos a você",
        paragraphs: [],
        bullets: [
          "Use senha forte e exclusiva",
          "Não compartilhe códigos de verificação ou links de recuperação",
          "Desconfie de e-mails/sites falsos pedindo sua senha",
          "Mantenha o navegador atualizado",
          `Reporte atividades suspeitas para ${LEGAL_SITE.contactEmail}`,
        ],
      },
      {
        heading: "3. Incidentes",
        paragraphs: [
          "Se tomarmos conhecimento de incidente de segurança relevante envolvendo dados pessoais, adotaremos medidas de contenção e comunicação conforme a LGPD e orientação da ANPD, quando aplicável.",
        ],
      },
      {
        heading: "4. Limitações",
        paragraphs: [
          "Nenhum serviço online é absolutamente seguro. Trabalhamos para reduzir riscos, mas não podemos garantir ausência total de falhas ou ataques.",
          disclaimer,
        ],
      },
    ],
  },
};
