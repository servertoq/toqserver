import type { SupabaseClient } from "@supabase/supabase-js";

export type FriendSuggestion = {
  profile_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  mutual_count: number;
};

export async function fetchFriendSuggestions(
  supabase: SupabaseClient,
  options?: { limit?: number; offset?: number }
) {
  const limit = options?.limit ?? 4;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase.rpc("get_friend_suggestions", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    if (error.message.includes("does not exist") || error.code === "42883") {
      return {
        data: [] as FriendSuggestion[],
        error: new Error(
          "Execute a migration 038_friend_suggestions.sql no Supabase para ativar sugestões."
        ),
      };
    }
    return { data: [] as FriendSuggestion[], error };
  }

  return {
    data: (data as FriendSuggestion[]) ?? [],
    error: null,
  };
}
