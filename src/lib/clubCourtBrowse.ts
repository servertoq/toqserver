import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClubCourt } from "@/types/clubFeatures";

export type BrowsableClubCourt = ClubCourt & {
  community?: { id: string; name: string; slug: string } | null;
  images?: { id: string; court_id: string; url: string; sort_order: number }[];
};

export type CourtTakenRange = {
  start_ts: string;
  end_ts: string;
};

export async function fetchClubCourtTakenRanges(
  supabase: SupabaseClient,
  courtId: string,
  dateISO: string
): Promise<CourtTakenRange[]> {
  const { data, error } = await supabase.rpc("club_court_taken_ranges", {
    p_court_id: courtId,
    p_date: dateISO,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as CourtTakenRange[];
}

export async function fetchBrowsableClubCourts(
  supabase: SupabaseClient,
  userId: string
): Promise<BrowsableClubCourt[]> {
  const { data: memberships } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId);

  const memberCommunityIds = new Set((memberships ?? []).map((m) => m.community_id));

  const { data, error } = await supabase
    .from("club_courts")
    .select(
      `
      *,
      community:communities(id, name, slug),
      images:club_court_images(id, court_id, url, sort_order),
      plans:club_court_plans(id, court_id, label, unit_label, unit_minutes, price, is_active, sort_order),
      hours:club_court_hours(id, court_id, weekday, start_time, end_time)
    `
    )
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => {
      const visibility = row.rental_visibility as string | undefined;
      if (visibility === "public") return true;
      return memberCommunityIds.has(row.community_id as string);
    })
    .map((row) => {
      const community = Array.isArray(row.community) ? row.community[0] : row.community;
      const images = Array.isArray(row.images) ? row.images : row.images ? [row.images] : [];
      const plans = Array.isArray(row.plans) ? row.plans : row.plans ? [row.plans] : [];
      const hours = Array.isArray(row.hours) ? row.hours : row.hours ? [row.hours] : [];
      const { community: _c, images: _i, plans: _p, hours: _h, ...court } = row;
      return { ...court, community, images, plans, hours } as BrowsableClubCourt;
    });
}

export async function fetchClubCourtDetail(
  supabase: SupabaseClient,
  courtId: string,
  userId: string
): Promise<BrowsableClubCourt | null> {
  const { data, error } = await supabase
    .from("club_courts")
    .select(
      `
      *,
      community:communities(id, name, slug),
      images:club_court_images(id, court_id, url, sort_order),
      plans:club_court_plans(id, court_id, label, unit_label, unit_minutes, price, is_active, sort_order),
      hours:club_court_hours(id, court_id, weekday, start_time, end_time),
      blocks:club_court_blocks(id, court_id, start_ts, end_ts, reason)
    `
    )
    .eq("id", courtId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  const visibility = data.rental_visibility as string | undefined;
  if (visibility !== "public") {
    const { data: member } = await supabase
      .from("community_members")
      .select("id")
      .eq("community_id", data.community_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return null;
  }

  const community = Array.isArray(data.community) ? data.community[0] : data.community;
  const images = Array.isArray(data.images) ? data.images : data.images ? [data.images] : [];
  const plans = Array.isArray(data.plans) ? data.plans : data.plans ? [data.plans] : [];
  const hours = Array.isArray(data.hours) ? data.hours : data.hours ? [data.hours] : [];
  const blocks = Array.isArray(data.blocks) ? data.blocks : data.blocks ? [data.blocks] : [];
  const { community: _c, images: _i, plans: _p, hours: _h, blocks: _b, ...court } = data;

  return { ...court, community, images, plans, hours, blocks } as BrowsableClubCourt;
}
