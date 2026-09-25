import { mapMentionRows } from "@/lib/mentions";
import { matchResultSetsFromRow } from "@/lib/matchResultSets";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FeedComment,
  FeedCommunity,
  FeedCoachListing,
  FeedPost,
  FeedProfile,
  MatchResultPayload,
  PostType,
  PostVisibility,
} from "@/types/feed";
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
  post_type: PostType;
  created_at: string;
  community_id: string | null;
  visibility?: PostVisibility;
  event_date?: string | null;
  event_time?: string | null;
  author: RawAuthor | RawAuthor[];
  images: { url: string; sort_order: number; media_type?: "image" | "video" }[] | null;
  communities: {
    name: string;
    slug: string;
    accent_color: string;
    created_by?: string | null;
  } | {
    name: string;
    slug: string;
    accent_color: string;
    created_by?: string | null;
  }[] | null;
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
  match?: { capacity: number } | { capacity: number }[] | null;
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
  clubCourtsByPostId?: Map<string, FeedClubCourt>,
  matchResultsByPostId?: Map<string, MatchResultPayload>
): FeedPost {
  const author = one(row.author);
  const community = one(row.communities);
  const pollRow = one(row.poll);
  const pollOptions = (row.poll_options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const matchRow = one(row.match);
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
      ? {
          name: community.name,
          slug: community.slug,
          accent_color: community.accent_color,
          created_by: community.created_by ?? null,
        }
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
    match_capacity: matchRow?.capacity ?? null,
    match_result: matchResultsByPostId?.get(row.id) ?? null,
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
  if (type === "partida") return "Partida";
  if (type === "match_result") return "Resultado";
  return "Post";
}

export async function fetchMatchResultsForPosts(
  supabase: SupabaseClient,
  postIds: string[]
): Promise<Map<string, MatchResultPayload>> {
  const map = new Map<string, MatchResultPayload>();
  if (postIds.length === 0) return map;

  const { data: links, error: linkErr } = await supabase
    .from("open_match_result_posts")
    .select("post_id, result_id")
    .in("post_id", postIds);

  if (linkErr || !links?.length) return map;

  const resultIds = [...new Set(links.map((l) => String(l.result_id)))];

  const [{ data: results }, { data: players }] = await Promise.all([
    supabase
      .from("open_match_results")
      .select(
        "id, open_match_id, format, team1_score, team2_score, set1_team1, set1_team2, set2_team1, set2_team2, set3_team1, set3_team2, share_scope, community_id, location_label, played_at"
      )
      .in("id", resultIds),
    supabase
      .from("open_match_result_players")
      .select("result_id, user_id, team, username, display_name, avatar_url, skill_label")
      .in("result_id", resultIds),
  ]);

  const resultById = new Map(
    (results ?? []).map((r) => [String(r.id), r] as const)
  );
  const playersByResult = new Map<string, MatchResultPayload["players"]>();
  for (const pl of players ?? []) {
    const rid = String(pl.result_id);
    const list = playersByResult.get(rid) ?? [];
    list.push({
      user_id: String(pl.user_id),
      team: Number(pl.team) === 2 ? 2 : 1,
      username: String(pl.username ?? ""),
      display_name: pl.display_name ? String(pl.display_name) : null,
      avatar_url: pl.avatar_url ? String(pl.avatar_url) : null,
      skill_label: String(pl.skill_label ?? ""),
    });
    playersByResult.set(rid, list);
  }

  for (const link of links) {
    const postId = String(link.post_id);
    const rid = String(link.result_id);
    const r = resultById.get(rid);
    if (!r) continue;
    const sets = matchResultSetsFromRow(r);
    map.set(postId, {
      result_id: rid,
      open_match_id: String(r.open_match_id),
      format: r.format === "1v1" ? "1v1" : r.format === "club" ? "club" : "2v2",
      team1_score: Number(r.team1_score ?? 0),
      team2_score: Number(r.team2_score ?? 0),
      set1_team1: r.set1_team1 != null ? Number(r.set1_team1) : null,
      set1_team2: r.set1_team2 != null ? Number(r.set1_team2) : null,
      set2_team1: r.set2_team1 != null ? Number(r.set2_team1) : null,
      set2_team2: r.set2_team2 != null ? Number(r.set2_team2) : null,
      set3_team1: r.set3_team1 != null ? Number(r.set3_team1) : null,
      set3_team2: r.set3_team2 != null ? Number(r.set3_team2) : null,
      sets,
      share_scope: r.share_scope === "participants" ? "participants" : "general",
      community_id: r.community_id ? String(r.community_id) : null,
      location_label: String(r.location_label ?? ""),
      played_at: String(r.played_at ?? ""),
      players: playersByResult.get(rid) ?? [],
    });
  }

  return map;
}

export type { FeedCommunity, FeedComment };
