export type AgendaEventType = "treino" | "aula" | "jogo" | "outro";

export type AgendaEvent = {
  id: string;
  user_id: string;
  event_date: string;
  event_time: string | null;
  event_type: AgendaEventType;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
