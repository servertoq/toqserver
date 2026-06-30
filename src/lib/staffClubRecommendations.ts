import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClubRecommendationStatus,
  ClubRecommendationWithReporter,
} from "@/types/clubRecommendations";

const SELECT = `
  id,
  user_id,
  club_name,
  contact,
  notes,
  status,
  created_at,
  reporter:profiles!club_recommendations_user_id_fkey(id, username, avatar_url, email)
`;

export function mapClubRecommendationRow(
  row: Record<string, unknown>
): ClubRecommendationWithReporter {
  const reporter = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    club_name: row.club_name as string,
    contact: row.contact as string,
    notes: (row.notes as string) ?? "",
    status: row.status as ClubRecommendationStatus,
    created_at: row.created_at as string,
    reporter: reporter as ClubRecommendationWithReporter["reporter"],
  };
}

export async function loadStaffClubRecommendations(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("club_recommendations")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapClubRecommendationRow(row as Record<string, unknown>));
}

export function clubRecommendationStatusLabel(status: ClubRecommendationStatus) {
  switch (status) {
    case "contacted":
      return "Contactado";
    case "added":
      return "Clube adicionado";
    case "dismissed":
      return "Descartado";
    default:
      return "Pendente";
  }
}

export function isClubRecommendationOpen(status: ClubRecommendationStatus) {
  return status === "pending" || status === "contacted";
}
