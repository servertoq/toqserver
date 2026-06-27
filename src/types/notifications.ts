import type { FeedProfile } from "@/types/feed";

export type NotificationType =
  | "post_like"
  | "post_comment"
  | "comment_reply"
  | "comment_like"
  | "comment_mention"
  | "friend_request"
  | "community_join"
  | "community_join_request"
  | "community_invite"
  | "staff_report_upheld"
  | "staff_report_dismissed"
  | "staff_suggestion_ack"
  | "staff_support_resolved";

export type AppNotification = {
  id: string;
  type: NotificationType;
  created_at: string;
  read_at: string | null;
  post_id: string | null;
  comment_id: string | null;
  community_id: string | null;
  friend_request_id: string | null;
  join_request_id: string | null;
  community_invite_id: string | null;
  support_ticket_id: string | null;
  actor: FeedProfile;
  community: { id: string; name: string; slug: string; kind?: "community" | "club" } | null;
};
