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
  | "community_invite";

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
  actor: FeedProfile;
  community: { id: string; name: string; slug: string; kind?: "community" | "club" } | null;
};
