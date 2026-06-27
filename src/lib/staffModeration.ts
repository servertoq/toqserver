import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffUserPost = {
  id: string;
  body: string;
  title: string | null;
  post_type: string;
  community_id: string | null;
  community_name: string | null;
  created_at: string;
};

export type StaffUserComment = {
  id: string;
  body: string;
  post_id: string;
  post_body_preview: string;
  created_at: string;
};

export type StaffCommunityResult = {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  created_at: string;
};

export type StaffCourtResult = {
  id: string;
  name: string;
  city: string;
  state: string;
  owner_username: string;
  created_at: string;
};

export type StaffClubCourtResult = {
  id: string;
  name: string;
  community_name: string;
  community_slug: string;
  created_at: string;
};

export type StaffTournamentResult = {
  id: string;
  name: string;
  community_name: string;
  community_slug: string;
  created_at: string;
};

export type DateRange = {
  from: string;
  to: string;
};

export function formatStaffDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateText(text: string, max = 160) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function dateParam(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export async function listStaffUserPosts(
  supabase: SupabaseClient,
  userId: string,
  range?: DateRange
) {
  const { data, error } = await supabase.rpc("staff_list_user_posts", {
    p_user_id: userId,
    p_date_from: range ? dateParam(range.from) : null,
    p_date_to: range ? dateParam(range.to) : null,
  });
  return { data: (data as StaffUserPost[]) ?? [], error };
}

export async function listStaffUserComments(
  supabase: SupabaseClient,
  userId: string,
  range?: DateRange
) {
  const { data, error } = await supabase.rpc("staff_list_user_comments", {
    p_user_id: userId,
    p_date_from: range ? dateParam(range.from) : null,
    p_date_to: range ? dateParam(range.to) : null,
  });
  return { data: (data as StaffUserComment[]) ?? [], error };
}

export async function searchStaffCommunities(supabase: SupabaseClient, query: string) {
  const { data, error } = await supabase.rpc("staff_search_communities", {
    p_query: query,
    p_limit: 20,
  });
  return { data: (data as StaffCommunityResult[]) ?? [], error };
}

export async function searchStaffCourts(supabase: SupabaseClient, query: string) {
  const { data, error } = await supabase.rpc("staff_search_courts", {
    p_query: query,
    p_limit: 20,
  });
  return { data: (data as StaffCourtResult[]) ?? [], error };
}

export async function searchStaffClubCourts(supabase: SupabaseClient, query: string) {
  const { data, error } = await supabase.rpc("staff_search_club_courts", {
    p_query: query,
    p_limit: 20,
  });
  return { data: (data as StaffClubCourtResult[]) ?? [], error };
}

export async function searchStaffTournaments(supabase: SupabaseClient, query: string) {
  const { data, error } = await supabase.rpc("staff_search_tournaments", {
    p_query: query,
    p_limit: 20,
  });
  return { data: (data as StaffTournamentResult[]) ?? [], error };
}

export async function deleteStaffPost(supabase: SupabaseClient, postId: string) {
  return supabase.rpc("staff_delete_post", { p_post_id: postId });
}

export async function deleteStaffComment(supabase: SupabaseClient, commentId: string) {
  return supabase.rpc("staff_delete_comment", { p_comment_id: commentId });
}

export async function deleteStaffCommunity(supabase: SupabaseClient, communityId: string) {
  return supabase.rpc("staff_delete_community", { p_community_id: communityId });
}

export async function deleteStaffCourt(supabase: SupabaseClient, courtId: string) {
  return supabase.rpc("staff_delete_court", { p_court_id: courtId });
}

export async function deleteStaffClubCourt(supabase: SupabaseClient, courtId: string) {
  return supabase.rpc("staff_delete_club_court", { p_court_id: courtId });
}

export async function deleteStaffTournament(supabase: SupabaseClient, tournamentId: string) {
  return supabase.rpc("staff_delete_tournament", { p_tournament_id: tournamentId });
}
