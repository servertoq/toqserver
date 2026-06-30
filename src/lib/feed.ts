import { mapMentionRows } from "@/lib/mentions";
import type { FeedComment, FeedCommunity, FeedPost, FeedProfile } from "@/types/feed";
import type { UserPlan } from "@/types/plans";

type RawPostRow = {
  id: string;
  body: string;
  title: string | null;
  post_type: "player" | "event";
  created_at: string;
  community_id: string | null;
  visibility?: "public" | "private";
  event_date?: string | null;
  event_time?: string | null;
  author:
    | {
        id: string;
        username: string;
        avatar_url: string | null;
        plan?: UserPlan;
        show_plan_badge?: boolean;
      }
    | {
        id: string;
        username: string;
        avatar_url: string | null;
        plan?: UserPlan;
        show_plan_badge?: boolean;
      }[];
  images: { url: string; sort_order: number; media_type?: "image" | "video" }[] | null;
  communities: { name: string; slug: string; accent_color: string } | { name: string; slug: string; accent_color: string }[] | null;
  mentions?: { mentioned_user: FeedProfile | FeedProfile[] | null }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapPostRow(
  row: RawPostRow,
  likesCount: number,
  commentsCount: number,
  likedByMe: boolean
): FeedPost {
  const author = one(row.author);
  const community = one(row.communities);

  return {
    id: row.id,
    body: row.body,
    title: row.title,
    post_type: row.post_type,
    created_at: row.created_at,
    community_id: row.community_id,
    visibility: row.visibility ?? "public",
    event_date: row.event_date ?? null,
    event_time: row.event_time ?? null,
    mentions: mapMentionRows(row.mentions),
    author: author ?? { id: "", username: "jogador", avatar_url: null, plan: "free", show_plan_badge: true },
    images: (row.images ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        ...img,
        media_type: img.media_type ?? "image",
      })),
    community: community
      ? { name: community.name, slug: community.slug, accent_color: community.accent_color }
      : null,
    likes_count: likesCount,
    comments_count: commentsCount,
    liked_by_me: likedByMe,
  };
}

export function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function postTypeLabel(type: FeedPost["post_type"]) {
  if (type === "event") return "Evento";
  return "Post";
}

export type { FeedCommunity, FeedComment };
