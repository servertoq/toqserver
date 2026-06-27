export type SupportTopic = "report" | "suggestion" | "help";

export type ReportTargetType = "post" | "profile" | "community";

export type ReportTarget = {
  type: ReportTargetType;
  id: string;
  label: string;
};

export type SupportTicket = {
  id: string;
  user_id: string;
  topic: SupportTopic;
  title: string;
  description: string;
  image_url: string | null;
  target_type: ReportTargetType | null;
  target_id: string | null;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_note?: string | null;
  read_at?: string | null;
  resolution_outcome?: "upheld" | "dismissed" | null;
};

export type SupportTicketWithReporter = SupportTicket & {
  reporter?: {
    id: string;
    username: string;
    avatar_url: string | null;
    email?: string | null;
  };
};
