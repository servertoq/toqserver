import { profilePath } from "@/lib/publicProfile";
import type { AppNotification, NotificationType } from "@/types/notifications";
import type { FeedProfile } from "@/types/feed";

export function notificationMessage(n: AppNotification): string {
  const name = n.actor.username;
  switch (n.type) {
    case "post_like":
      return `${name} curtiu sua publicação`;
    case "post_comment":
      return `${name} comentou na sua publicação`;
    case "comment_reply":
      return `${name} respondeu seu comentário`;
    case "comment_like":
      return `${name} curtiu seu comentário`;
    case "comment_mention":
      return `${name} mencionou você em um comentário`;
    case "friend_request":
      return `${name} quer ser seu amigo`;
    case "community_join":
      return `${name} entrou em ${n.community?.name ?? "uma comunidade"}`;
    case "community_join_request":
      return `${name} pediu para entrar em ${n.community?.name ?? "uma comunidade"}`;
    default:
      return "Nova notificação";
  }
}

export function notificationHref(n: AppNotification): string | null {
  if (n.type === "friend_request") {
    return n.actor.username ? profilePath(n.actor.username) : null;
  }

  if (
    n.type === "post_comment" ||
    n.type === "comment_reply" ||
    n.type === "comment_like" ||
    n.type === "comment_mention"
  ) {
    const slug = n.community?.slug;
    const base = slug ? `/inicio/comunidade/${slug}` : "/inicio";
    const params = new URLSearchParams();
    if (n.post_id) params.set("post", n.post_id);
    if (n.comment_id) params.set("comment", n.comment_id);
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  }

  const slug = n.community?.slug;
  const base = slug ? `/inicio/comunidade/${slug}` : "/inicio";
  const params = new URLSearchParams();

  if (n.post_id) params.set("post", n.post_id);
  if (n.comment_id) params.set("comment", n.comment_id);

  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function mapNotificationRow(row: {
  id: string;
  type: NotificationType;
  created_at: string;
  read_at: string | null;
  post_id: string | null;
  comment_id: string | null;
  community_id: string | null;
  friend_request_id: string | null;
  join_request_id: string | null;
  actor: FeedProfile | FeedProfile[] | null;
  community: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
}): AppNotification {
  const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
  const community = Array.isArray(row.community) ? row.community[0] : row.community;

  return {
    id: row.id,
    type: row.type,
    created_at: row.created_at,
    read_at: row.read_at,
    post_id: row.post_id,
    comment_id: row.comment_id,
    community_id: row.community_id,
    friend_request_id: row.friend_request_id,
    join_request_id: row.join_request_id,
    actor: actor ?? { id: "", username: "?", avatar_url: null },
    community: community ?? null,
  };
}
