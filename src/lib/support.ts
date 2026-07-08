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
  supabase: SupabaseClient,
  userId: string,
  ticketId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${ticketId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("support-images")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) return null;

  const { data } = supabase.storage.from("support-images").getPublicUrl(path);
  return data.publicUrl;
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
