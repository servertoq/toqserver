import { mapMentionRows } from "@/lib/mentions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedComment, FeedCommunity, FeedCoachListing, FeedPost, FeedProfile } from "@/types/feed";
import type { FeedClubCourt } from "@/types/courtManagement";
import type { UserPlan } from "@/types/plans";
import type { StaffRole } from "@/types/staff";
import { staffRoleFromEmbed } from "@/lib/staff";

type StaffMemberEmbed = { role: StaffRole } | { role: StaffRole }[] | null;

type RawAuthor = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url: string | null;
  plan?: UserPlan;
  show_plan_badge?: boolean;
  staff_members?: StaffMemberEmbed;
};

type RawPostRow = {
  id: string;
  body: string;
  title: string | null;
  post_type: "player" | "event" | "poll" | "coach" | "court";
  created_at: string;
  community_id: string | null;
  visibility?: "public" | "private";
  event_date?: string | null;
  event_time?: string | null;
  author: RawAuthor | RawAuthor[];
  images: { url: string; sort_order: number; media_type?: "image" | "video" }[] | null;
  communities: { name: string; slug: string; accent_color: string } | { name: string; slug: string; accent_color: string }[] | null;
  mentions?: { mentioned_user: FeedProfile | FeedProfile[] | null }[] | null;
  poll?:
    | {
        allow_multiple: boolean;
        show_results_to_all: boolean;
      }
    | {
        allow_multiple: boolean;
        show_results_to_all: boolean;
      }[]
    | null;
  poll_options?: { id: string; label: string; sort_order: number }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapFeedAuthor(author: RawAuthor | null): FeedProfile {
  if (!author) {
    return { id: "", username: "jogador", avatar_url: null, plan: "free", show_plan_badge: true, staff_role: null };
  }
  return {
    id: author.id,
    username: author.username,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
    plan: author.plan,
    show_plan_badge: author.show_plan_badge,
    staff_role: staffRoleFromEmbed(author.staff_members),
  };
}

export function mapPostRow(
  row: RawPostRow,
  likesCount: number,
  commentsCount: number,
  likedByMe: boolean,
  coachListingPostIds?: Set<string>,
  coachListingsByPostId?: Map<string, FeedCoachListing>,
  clubCourtsByPostId?: Map<string, FeedClubCourt>
): FeedPost {
  const author = one(row.author);
  const community = one(row.communities);
  const pollRow = one(row.poll);
  const pollOptions = (row.poll_options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const coachListing = coachListingsByPostId?.get(row.id) ?? null;
  const clubCourt = clubCourtsByPostId?.get(row.id) ?? null;
  const isCoachListing =
    row.post_type === "coach" || (coachListingPostIds?.has(row.id) ?? false) || !!coachListing;
  const isClubCourtPost = row.post_type === "court" || !!clubCourt;

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
    author: mapFeedAuthor(author),
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
    poll: pollRow
      ? {
          allow_multiple: pollRow.allow_multiple,
          show_results_to_all: pollRow.show_results_to_all,
          options: pollOptions,
        }
      : null,
    is_coach_listing: isCoachListing,
    coach_listing: coachListing,
    is_club_court: isClubCourtPost,
    club_court: clubCourt,
  };
}

export async function fetchCoachListingsForPosts(
  supabase: SupabaseClient,
  postIds: string[]
): Promise<Map<string, FeedCoachListing>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("coach_listings")
    .select("id, user_id, title, price_label, contact_whatsapp, post_id")
    .in("post_id", postIds)
    .eq("is_active", true);

  if (error) return new Map();

  const map = new Map<string, FeedCoachListing>();
  for (const row of data ?? []) {
    const postId = row.post_id as string | null;
    if (!postId) continue;
    map.set(postId, {
      id: row.id as string,
      user_id: row.user_id as string,
      title: row.title as string,
      price_label: row.price_label as string,
      contact_whatsapp: row.contact_whatsapp as string,
    });
  }
  return map;
}

export async function fetchClubCourtsForPosts(
  supabase: SupabaseClient,
  postIds: string[]
): Promise<Map<string, FeedClubCourt>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("club_courts")
    .select("id, name, community_id, contact_phone, rental_visibility, rental_available, rental_unavailable_note, post_id, community:communities(name, slug)")
    .in("post_id", postIds)
    .eq("is_active", true);

  if (error) return new Map();

  const map = new Map<string, FeedClubCourt>();
  for (const row of data ?? []) {
    const postId = row.post_id as string | null;
    if (!postId) continue;
    const community = Array.isArray(row.community) ? row.community[0] : row.community;
    map.set(postId, {
      id: row.id as string,
      name: row.name as string,
      community_id: row.community_id as string,
      contact_phone: row.contact_phone as string,
      rental_visibility: row.rental_visibility as FeedClubCourt["rental_visibility"],
      rental_available: row.rental_available as boolean | undefined,
      rental_unavailable_note: row.rental_unavailable_note as string | null | undefined,
      community_name: (community as { name?: string } | null)?.name,
      community_slug: (community as { slug?: string } | null)?.slug,
    });
  }
  return map;
}

export async function fetchCoachListingPostIds(
  supabase: SupabaseClient,
  postIds: string[]
): Promise<Set<string>> {
  const listings = await fetchCoachListingsForPosts(supabase, postIds);
  return new Set(listings.keys());
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
  if (type === "poll") return "Enquete";
  if (type === "coach") return "Professor";
  if (type === "court") return "Quadra";
  return "Post";
}

export type { FeedCommunity, FeedComment };
