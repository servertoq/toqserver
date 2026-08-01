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
        heading: "5. Planos disponíveis e ciclo de uso",
        paragraphs: [
          `A ${LEGAL_SITE.brand} oferece um plano gratuito (“Usuário”) e planos pagos opcionais. Os planos pagos atuais e preços de referência por ciclo de 30 dias são:`,
        ],
        bullets: [
          "Usuário (gratuito): uso básico da plataforma, com limites do plano (ex.: até 3 comunidades)",
          "Professor — R$ 20 / 30 dias",
          "Promotor — R$ 50 / 30 dias",
          "Proprietário — R$ 99 / 30 dias",
          "Proprietário Plus — R$ 189 / 30 dias",
        ],
      },
      {
        heading: "5.1. Validade e benefícios",
        paragraphs: [
          "Cada pagamento aprovado de plano pago concede (ou estende) um ciclo de 30 dias de uso das funções daquele plano, contados conforme as regras de renovação e upgrade abaixo.",
          "Os benefícios (badges, limites de clube/quadras/anúncios, destaques no feed, painéis de gestão etc.) valem apenas enquanto o plano estiver ativo e dentro da validade. A lista detalhada de benefícios aparece na página de Planos do aplicativo e pode ser atualizada.",
          "Funcionalidades entre usuários (aulas, reservas, torneios, vendas em clube etc.) continuam sendo relações entre as partes; o plano apenas libera recursos da plataforma.",
        ],
      },
      {
        heading: "6. Processador de pagamento (Mercado Pago)",
        paragraphs: [
          "Cobranças de planos são processadas pelo Mercado Pago (Checkout Pro / meios oferecidos por ele). Ao pagar, você também se sujeita aos termos e políticas do Mercado Pago.",
          "Não armazenamos número completo de cartão nem dados sensíveis de pagamento em nossos servidores. Identificadores de pagamento, preferência, assinatura e status podem ser registrados para liberar o plano, suporte e auditoria.",
          "A liberação do plano ocorre após confirmação do pagamento (incluindo notificação/webhook do Mercado Pago). Em Pix, a confirmação pode levar alguns minutos; a tela do Mercado Pago pode não redirecionar automaticamente — você pode voltar ao site; o plano deve ativar mesmo assim após a confirmação.",
          "Pagamentos pendentes, recusados, cancelados ou expirados (ex.: Pix não pago no prazo) não liberam nem renovam o plano.",
        ],
      },
      {
        heading: "7. Formas de pagamento",
        paragraphs: ["No checkout de planos, conforme disponibilidade no Mercado Pago e na plataforma:"],
        bullets: [
          "Pix — pagamento avulso; renovação é manual (você inicia novo pagamento antes ou após o vencimento)",
          "Cartão (pagamento único / avulso) — cobra o ciclo atual; renovação também é manual",
          "Cartão com renovação automática (assinatura/preapproval) — cobranças periódicas pelo Mercado Pago enquanto a assinatura estiver ativa",
        ],
      },
      {
        heading: "8. Nova assinatura e renovação (acúmulo de prazo)",
        paragraphs: [
          "Assinatura nova (conta no plano Usuário → plano pago): cobra o valor integral do plano escolhido e inicia um ciclo de 30 dias a partir da confirmação do pagamento.",
          "Renovação do mesmo plano (antes ou depois do vencimento, conforme o caso): cobra o valor integral do plano. Se ainda houver validade restante, os novos 30 dias são somados ao vencimento atual (o prazo acumula). Exemplo: restam 14 dias e você renova → passa a ter aproximadamente 44 dias de validade.",
          "Se o plano já tiver vencido e a conta tiver retornado ao Usuário, um novo pagamento de plano pago inicia um novo ciclo de 30 dias.",
          "Em Pix e cartão avulso, enviamos lembrete de renovação por e-mail cerca de 3 dias antes do vencimento, quando configurado. A ausência do e-mail não isenta a responsabilidade de renovar a tempo se desejar manter o plano.",
        ],
      },
      {
        heading: "9. Upgrade (plano superior)",
        paragraphs: [
          "Upgrade é a mudança para um plano de ordem superior (ex.: Professor → Promotor → Proprietário → Proprietário Plus), mediante pagamento.",
          "Nos primeiros 15 dias contados da ativação/renovação do ciclo atual (data de ativação do plano no perfil): o upgrade cobra apenas a diferença de preço entre o plano atual e o destino. Nesse caso, a data de vencimento do ciclo atual é mantida (não se somam 30 dias extras só pela diferença).",
          "Após esses 15 dias (ex.: a partir do 16º dia do ciclo): o upgrade cobra o valor integral do plano de destino. Os 30 dias do novo pagamento são somados ao que ainda resta de validade do ciclo anterior. Exemplo: no dia 16, restando cerca de 14 dias, e upgrade com valor cheio → aproximadamente 14 + 30 dias no plano novo.",
          "Não é permitido “pular” pagamento: upgrade só se conclui com pagamento aprovado no Mercado Pago.",
        ],
      },
      {
        heading: "10. Redução de plano, cancelamento e expiração",
        paragraphs: [
          "Não é possível reduzir o plano (downgrade) no meio do ciclo ativo pela própria conta — inclusive voltar imediatamente de um plano pago para Usuário ou para um plano inferior. O ciclo pago já adquirido permanece até o vencimento.",
          "Ao vencer o prazo sem renovação ou pagamento de plano igual/superior, a conta retorna automaticamente ao plano Usuário (gratuito) e as funções exclusivas do plano pago são desligadas. Conteúdo criado sob o plano pago pode ficar sujeito aos limites do Usuário; pode ser necessário reduzir comunidades, clubes, quadras ou anúncios para voltar a operar dentro dos limites.",
          "Cancelamento de renovação automática no cartão: você deve cancelar a assinatura/recorrência no ambiente do Mercado Pago e/ou solicitar apoio em nosso contato. O cancelamento da recorrência impede novas cobranças futuras; não encerra de imediato o período já pago, que segue até a data de vencimento, salvo regra legal de reembolso aplicável.",
          "Cancelar ou não renovar Pix/cartão avulso simplesmente implica não iniciar novo pagamento; o plano segue até o vencimento e depois volta a Usuário.",
          "Banimento, suspensão por violação destes Termos ou exclusão de conta podem interromper o acesso independentemente do ciclo pago, sem prejuízo de regras de reembolso quando a lei exigir.",
        ],
      },
      {
        heading: "11. Preços, impostos e alterações comerciais",
        paragraphs: [
          "Os preços exibidos na página de Planos e no checkout prevalecem no momento da cobrança. Valores neste documento são de referência e podem ser atualizados.",
          "Podemos alterar preços, benefícios, nomes de planos e regras de ciclo. Mudanças passam a valer para novas cobranças e novos ciclos após divulgação na plataforma e/ou nestes Termos. Ciclos já pagos em geral mantêm os benefícios adquiridos até o vencimento, salvo ajuste legal ou técnico indispensável.",
          "Tributos, tarifas do meio de pagamento ou encargos do Mercado Pago/banco podem ser aplicados conforme a legislação e as regras do processador.",
        ],
      },
      {
        heading: "12. Falhas, chargeback e uso indevido",
        paragraphs: [
          "Em caso de pagamento confirmado sem liberação do plano por falha nossa, corrigiremos a liberação e/ou trataremos reembolso conforme a Política de Reembolso.",
          "Contestação indevida (chargeback) após uso do benefício, fraude ou abuso podem resultar em suspensão da conta e cobrança/recuperação pelos meios legais cabíveis.",
          "Detalhes de arrependimento (CDC), estornos e prazos estão na Política de Reembolso e devolução.",
        ],
      },
      {
        heading: "13. Conduta e uso aceitável",
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
        heading: "14. Propriedade intelectual",
        paragraphs: [
          `Marca, layout, código e materiais da ${LEGAL_SITE.brand} pertencem a nós ou a licenciadores. Uso não autorizado é vedado.`,
        ],
      },
      {
        heading: "15. Limitação de responsabilidade",
        paragraphs: [
          "O serviço é oferecido “como está”, dentro dos limites da lei. Não garantimos disponibilidade ininterrupta nem resultados específicos de partidas, aulas ou negócios entre usuários.",
          "Interações e contratos entre usuários (ex.: aulas, aluguel de quadras) são de responsabilidade das partes envolvidas, salvo quando a lei imponha obrigação diversa.",
          "Não nos responsabilizamos por indisponibilidade, atrasos ou falhas do Mercado Pago, bancos, Pix ou operadoras de cartão, além do que a lei exigir.",
        ],
      },
      {
        heading: "16. Alterações e contato",
        paragraphs: [
          `Podemos atualizar estes Termos. A data de vigência será atualizada nesta página. Dúvidas sobre uso, planos ou pagamentos: ${LEGAL_SITE.contactEmail}.`,
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
          "Pagamentos: dados de cobrança processados pelo Mercado Pago (Pix e cartão; nós não armazenamos número completo de cartão); identificadores de pagamento/assinatura, plano, datas de ativação/vencimento e histórico de mudanças de plano",
          "Comunicações: e-mails transacionais (autenticação, lembrete de renovação de plano cerca de 3 dias antes do vencimento, quando configurado)",
          "Mapas: Google Maps ao cadastrar ou visualizar quadras, quando o recurso for utilizado",
          "Dados técnicos: IP, tipo de dispositivo/navegador, logs de segurança e cookies essenciais",
          "Login social: dados fornecidos pelo Google OAuth quando você escolhe essa opção",
        ],
      },
      {
        heading: "3. Finalidades e bases legais",
        paragraphs: [
          "Tratamos dados para: prestar o serviço; autenticar contas; personalizar a experiência (incluindo proximidade geográfica quando autorizado); processar assinaturas, renovações e upgrades de plano; enviar lembretes de vencimento; gerenciar reservas e agendas; moderar a comunidade; cumprir obrigações legais; e melhorar segurança e estabilidade.",
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
          "Resend — envio de e-mails transacionais (autenticação e, quando configurado, lembretes de renovação de plano)",
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
    description: "Regras para cobranças, cancelamentos e estornos de planos na Toq Tennis.",
    sections: [
      {
        heading: "1. Escopo",
        paragraphs: [
          `Esta política cobre cobranças de planos pagos da ${LEGAL_SITE.brand} (Professor, Promotor, Proprietário e Proprietário Plus), processadas pelo Mercado Pago (Pix, cartão avulso ou cartão com renovação automática).`,
          "Não cobre valores cobrados por terceiros fora da plataforma (ex.: aula particular, aluguel de quadra pago diretamente ao clube), nem produtos físicos de lojas de clube quando a venda for entre usuários/clube — nesses casos, a relação é entre as partes.",
          disclaimer,
        ],
      },
      {
        heading: "2. Natureza do produto digital",
        paragraphs: [
          "O plano pago é um serviço digital de acesso a funcionalidades da plataforma por ciclo de 30 dias (ou pelo prazo acumulado conforme renovação/upgrade descritos nos Termos de uso).",
          "Após a liberação do plano, o benefício passa a ser utilizável imediatamente. Isso pode influenciar a análise de reembolso após o prazo legal de arrependimento.",
        ],
      },
      {
        heading: "3. Direito de arrependimento (CDC)",
        paragraphs: [
          "Se você for consumidor e a contratação for à distância (online), a legislação brasileira pode assegurar o direito de arrependimento em até 7 (sete) dias corridos a contar da confirmação do pagamento/contratação, nos termos do Código de Defesa do Consumidor, quando aplicável.",
          `Para solicitar, envie e-mail a ${LEGAL_SITE.contactEmail} com: e-mail da conta, data e valor do pagamento, identificador do pagamento no Mercado Pago (se tiver) e pedido de arrependimento. Analisaremos e responderemos em prazo razoável.`,
          "Se o reembolso por arrependimento for integralmente deferido, o plano poderá ser revertido ao estado anterior (em geral Usuário ou o plano imediatamente anterior, conforme o caso).",
        ],
      },
      {
        heading: "4. Cancelamento sem reembolso (regra geral)",
        paragraphs: [
          "Fora do direito de arrependimento e das hipóteses da seção 5:",
        ],
        bullets: [
          "Não há reembolso proporcional pelo tempo não usado do ciclo já pago",
          "Não há reembolso pelo simples desuso do plano ou insatisfação subjetiva sem falha nossa",
          "Não é possível “devolver” o plano no meio do ciclo para receber o valor de volta e voltar a Usuário — o ciclo segue até o vencimento; depois, sem renovação, a conta volta a Usuário automaticamente",
          "Cancelar a renovação automática do cartão interrompe cobranças futuras, mas não gera estorno do período já pago",
        ],
      },
      {
        heading: "5. Hipóteses em que podemos reembolsar",
        paragraphs: ["Podemos avaliar reembolso total ou parcial, a nosso critério e/ou por obrigação legal, quando:"],
        bullets: [
          "Cobrança duplicada comprovada do mesmo ciclo",
          "Pagamento aprovado sem liberação do plano por falha técnica nossa, após tentativa de correção",
          "Valor cobrado indevidamente (ex.: valor divergente do checkout por erro nosso)",
          "Determinação legal, de órgão de defesa do consumidor ou ordem judicial",
        ],
      },
      {
        heading: "6. Upgrade, renovação e valores",
        paragraphs: [
          "Upgrade nos primeiros 15 dias do ciclo (diferença de preço) e upgrade após 15 dias (valor integral), bem como renovação com acúmulo de prazo, seguem os Termos de uso. Reembolso desses valores, quando cabível, observa as mesmas seções 3 a 5 desta política.",
          "Renovação antecipada que acumula dias não gera direito automático a estorno do saldo de dias; o serviço digital permanece disponível pelo prazo estendido.",
        ],
      },
      {
        heading: "7. Como o estorno é feito",
        paragraphs: [
          "Estornos aprovados são processados via Mercado Pago, preferencialmente no mesmo meio (Pix ou cartão). O prazo para o crédito aparecer na conta/fatura depende do banco, da bandeira e do Mercado Pago — tipicamente alguns dias úteis, podendo variar.",
          "Não devolvemos valores em dinheiro vivo nem por meios alheios ao fluxo do processador, salvo acordo excepcional e base legal.",
        ],
      },
      {
        heading: "8. Chargeback e contestação no cartão",
        paragraphs: [
          "Antes de contestar no banco/cartão, solicite suporte pelo nosso e-mail — muitas vezes resolvemos mais rápido.",
          "Chargeback após uso do plano, ou de má-fé, pode levar à suspensão da conta e à cobrança dos custos/valores devidos.",
        ],
      },
      {
        heading: "9. Contato",
        paragraphs: [
          `Solicitações de reembolso, cancelamento de recorrência com apoio nosso e dúvidas: ${LEGAL_SITE.contactEmail}.`,
          `Também: ${LEGAL_SITE.whatsappDisplay} (WhatsApp) e Instagram ${LEGAL_SITE.instagramHandle}.`,
        ],
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
