import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportTargetType, SupportTopic } from "@/types/support";

export const SUPPORT_TOPICS: {
  id: SupportTopic;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    id: "report",
    label: "Denúncia",
    description: "Reporte comportamento inadequado, spam ou violação das regras.",
    emoji: "🚩",
  },
  {
    id: "suggestion",
    label: "Sugestão",
    description: "Compartilhe ideias para melhorar a plataforma Toq Tennis.",
    emoji: "💡",
  },
  {
    id: "help",
    label: "Preciso de ajuda",
    description: "Dúvidas, problemas técnicos ou dificuldade para usar o app.",
    emoji: "🤝",
  },
];

export function supportTopicLabel(topic: SupportTopic) {
  return SUPPORT_TOPICS.find((t) => t.id === topic)?.label ?? topic;
}

export async function uploadSupportImage(
  _supabase: SupabaseClient,
  userId: string,
  ticketId: string,
  file: File
): Promise<string | null> {
  try {
    const { uploadMediaToR2 } = await import("@/lib/mediaUpload");
    const { publicUrl } = await uploadMediaToR2(file, {
      folder: "support-images",
      pathPrefix: `${userId}/${ticketId}`,
    });
    return publicUrl;
  } catch {
    return null;
  }
}

export function reportTargetHeading(type: ReportTargetType) {
  switch (type) {
    case "post":
      return "Denunciar publicação";
    case "profile":
      return "Denunciar perfil";
    case "community":
      return "Denunciar comunidade";
    case "comment":
      return "Denunciar comentário";
  }
}
