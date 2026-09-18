import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateOpenMatchInput,
  OpenMatchDetail,
  OpenMatchFormat,
  OpenMatchListItem,
  OpenMatchPlayer,
  UpdateOpenMatchInput,
} from "@/types/openMatches";

export function formatMatchSkillLevel(level: number) {
  const n = Number(level);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

export function openMatchFormatLabel(format: string) {
  if (format === "1v1") return "Jogo de simples";
  if (format === "club") return "Partida do clube";
  return "Jogo de duplas";
}

export function formatDayUsePrice(price: number) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return "Grátis";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatMatchWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day.replace(".", "")}, ${time}`;
}

export function openMatchSpotsLeft(item: {
  capacity: number;
  confirmed_count: number;
}) {
  return Math.max(0, item.capacity - item.confirmed_count);
}

function mapFormat(raw: unknown): OpenMatchFormat {
  if (raw === "1v1") return "1v1";
  if (raw === "club") return "club";
  return "2v2";
}

function mapListRow(row: Record<string, unknown>): OpenMatchListItem {
  return {
    id: String(row.id),
    match_number: Number(row.match_number),
    created_by: String(row.created_by),
    format: mapFormat(row.format),
    capacity: Number(row.capacity),
    skill_level: Number(row.skill_level),
    court_name: String(row.court_name ?? ""),
    city: String(row.city ?? ""),
    community_id: row.community_id ? String(row.community_id) : null,
    community_name: row.community_name ? String(row.community_name) : null,
    community_cover_url: row.community_cover_url ? String(row.community_cover_url) : null,
    community_city: row.community_city ? String(row.community_city) : null,
    community_state: row.community_state ? String(row.community_state) : null,
    post_id: row.post_id ? String(row.post_id) : null,
    has_password: Boolean(row.has_password),
    starts_at: String(row.starts_at),
    status: (row.status as OpenMatchListItem["status"]) ?? "open",
    notes: String(row.notes ?? ""),
    created_at: String(row.created_at),
    confirmed_count: Number(row.confirmed_count ?? 0),
    pending_count: Number(row.pending_count ?? 0),
    creator_username: String(row.creator_username ?? ""),
    creator_display_name: row.creator_display_name
      ? String(row.creator_display_name)
      : null,
    creator_avatar_url: row.creator_avatar_url ? String(row.creator_avatar_url) : null,
    viewer_is_member: Boolean(row.viewer_is_member),
    day_use_allow_outsiders: row.day_use_allow_outsiders !== false,
    day_use_price: Number(row.day_use_price ?? 0),
  };
}

export async function searchOpenMatches(
  supabase: SupabaseClient,
  query: string,
  limit = 40
): Promise<{ items: OpenMatchListItem[]; error: string | null }> {
  const { data, error } = await supabase.rpc("search_open_matches", {
    p_query: query.trim() || null,
    p_limit: limit,
  });
  if (error) {
    return { items: [], error: error.message };
  }
  const rows = Array.isArray(data) ? data : [];
  return {
    items: rows.map((r) => mapListRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function createOpenMatch(
  supabase: SupabaseClient,
  input: CreateOpenMatchInput
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_open_match", {
    p_format: input.format === "club" ? "2v2" : input.format,
    p_skill_level: input.skillLevel,
    p_court_name: input.courtName.trim(),
    p_city: input.city.trim(),
    p_starts_at: input.startsAt,
    p_password: input.password?.trim() || null,
    p_community_id: input.communityId || null,
    p_notes: input.notes?.trim() || "",
  });
  if (error) return { id: null, error: error.message };
  return { id: data ? String(data) : null, error: null };
}

export async function joinOpenMatch(
  supabase: SupabaseClient,
  matchId: string,
  opts?: { password?: string; team?: 1 | 2; dayUseAccepted?: boolean }
): Promise<{ status: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("join_open_match", {
    p_match_id: matchId,
    p_password: opts?.password?.trim() || null,
    p_team: opts?.team ?? null,
    p_day_use_accepted: opts?.dayUseAccepted ?? false,
  });
  if (error) return { status: null, error: error.message };
  return { status: data ? String(data) : null, error: null };
}

export async function respondOpenMatchJoin(
  supabase: SupabaseClient,
  matchId: string,
  userId: string,
  accept: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("respond_open_match_join", {
    p_match_id: matchId,
    p_user_id: userId,
    p_accept: accept,
  });
  return { error: error?.message ?? null };
}

export async function cancelOpenMatch(
  supabase: SupabaseClient,
  matchId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("cancel_open_match", { p_match_id: matchId });
  return { error: error?.message ?? null };
}

export async function updateOpenMatch(
  supabase: SupabaseClient,
  matchId: string,
  input: UpdateOpenMatchInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("update_open_match", {
    p_match_id: matchId,
    p_court_name: input.courtName.trim(),
    p_city: input.city.trim(),
    p_starts_at: input.startsAt,
  });
  return { error: error?.message ?? null };
}

export async function kickOpenMatchPlayer(
  supabase: SupabaseClient,
  matchId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("kick_open_match_player", {
    p_match_id: matchId,
    p_user_id: userId,
  });
  return { error: error?.message ?? null };
}

export async function inviteToOpenMatch(
  supabase: SupabaseClient,
  matchId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("invite_to_open_match", {
    p_match_id: matchId,
    p_user_id: userId,
  });
  return { error: error?.message ?? null };
}

export async function respondOpenMatchInvite(
  supabase: SupabaseClient,
  matchId: string,
  accept: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("respond_open_match_invite", {
    p_match_id: matchId,
    p_accept: accept,
  });
  return { error: error?.message ?? null };
}

export type OpenMatchProfileSearchResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function searchProfilesForOpenMatch(
  supabase: SupabaseClient,
  query: string,
  limit = 8
): Promise<{ items: OpenMatchProfileSearchResult[]; error: string | null }> {
  const { data, error } = await supabase.rpc("search_profiles_for_open_match", {
    p_query: query.trim(),
    p_limit: limit,
  });
  if (error) return { items: [], error: error.message };
  const rows = Array.isArray(data) ? data : [];
  return {
    items: rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        username: String(row.username ?? ""),
        display_name: row.display_name ? String(row.display_name) : null,
        avatar_url: row.avatar_url ? String(row.avatar_url) : null,
      };
    }),
    error: null,
  };
}

export async function getOpenMatchDetail(
  supabase: SupabaseClient,
  matchId: string
): Promise<{ match: OpenMatchDetail | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_open_match_detail", {
    p_match_id: matchId,
  });
  if (error) return { match: null, error: error.message };
  if (!data) return { match: null, error: null };

  const raw = data as Record<string, unknown>;
  const playersRaw = Array.isArray(raw.players) ? raw.players : [];
  const players: OpenMatchPlayer[] = playersRaw.map((p) => {
    const row = p as Record<string, unknown>;
    return {
      user_id: String(row.user_id),
      team: Number(row.team) === 2 ? 2 : 1,
      status: (row.status as OpenMatchPlayer["status"]) ?? "pending",
      day_use_accepted: Boolean(row.day_use_accepted),
      username: String(row.username ?? ""),
      display_name: row.display_name ? String(row.display_name) : null,
      avatar_url: row.avatar_url ? String(row.avatar_url) : null,
      created_at: String(row.created_at ?? ""),
    };
  });

  return {
    match: {
      id: String(raw.id),
      match_number: Number(raw.match_number),
      created_by: String(raw.created_by),
      format: mapFormat(raw.format),
      capacity: Number(raw.capacity),
      skill_level: Number(raw.skill_level),
      court_name: String(raw.court_name ?? ""),
      city: String(raw.city ?? ""),
      community_id: raw.community_id ? String(raw.community_id) : null,
      community_name: raw.community_name ? String(raw.community_name) : null,
      community_cover_url: raw.community_cover_url
        ? String(raw.community_cover_url)
        : null,
      community_city: raw.community_city ? String(raw.community_city) : null,
      community_state: raw.community_state ? String(raw.community_state) : null,
      post_id: raw.post_id ? String(raw.post_id) : null,
      has_password: Boolean(raw.has_password),
      starts_at: String(raw.starts_at),
      status: (raw.status as OpenMatchDetail["status"]) ?? "open",
      notes: String(raw.notes ?? ""),
      created_at: String(raw.created_at),
      creator_username: String(raw.creator_username ?? ""),
      creator_display_name: raw.creator_display_name
        ? String(raw.creator_display_name)
        : null,
      creator_avatar_url: raw.creator_avatar_url ? String(raw.creator_avatar_url) : null,
      viewer_is_member: Boolean(raw.viewer_is_member),
      day_use_allow_outsiders: raw.day_use_allow_outsiders !== false,
      day_use_price: Number(raw.day_use_price ?? 0),
      players,
    },
    error: null,
  };
}

export async function completeOpenMatch(
  supabase: SupabaseClient,
  matchId: string,
  input: {
    team1Score: number;
    team2Score: number;
    shareScope: "participants" | "general";
  }
): Promise<{ resultId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("complete_open_match", {
    p_match_id: matchId,
    p_team1_score: input.team1Score,
    p_team2_score: input.team2Score,
    p_share_scope: input.shareScope,
  });
  if (error) return { resultId: null, error: error.message };
  return { resultId: data ? String(data) : null, error: null };
}

export async function updateMatchResultVisibility(
  supabase: SupabaseClient,
  postId: string,
  mode: "everyone" | "friends" | "club" | "participants"
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("update_match_result_visibility", {
    p_post_id: postId,
    p_mode: mode,
  });
  return { error: error?.message ?? null };
}

export function shortPlayerName(displayName: string | null, username: string) {
  const base = (displayName?.trim() || username).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 12);
  return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
}

export function needsDayUseFlow(match: Pick<
  OpenMatchListItem,
  "community_id" | "viewer_is_member" | "day_use_allow_outsiders"
>) {
  return Boolean(match.community_id && !match.viewer_is_member && match.day_use_allow_outsiders);
}
