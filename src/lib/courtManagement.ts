import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CourtBookingWithDetails,
  CourtManagementStats,
  ManualCourtBookingForm,
} from "@/types/courtManagement";
import type { ClubCourt } from "@/types/clubFeatures";
import type { FeedProfile } from "@/types/feed";

const BOOKING_SELECT = `
  id,
  club_court_id,
  plan_id,
  requester_id,
  guest_name,
  guest_phone,
  booking_date,
  start_time,
  end_time,
  quantity,
  total_price,
  status,
  is_manual,
  notes,
  paid_at,
  confirmed_at,
  completed_at,
  cancelled_at,
  created_at,
  court:club_courts!club_court_bookings_club_court_id_fkey(
    id,
    name,
    community_id,
    community:communities(id, name, slug)
  ),
  plan:club_court_plans(id, court_id, label, unit_label, unit_minutes, price, is_active, sort_order),
  requester:profiles!club_court_bookings_requester_id_fkey(id, username, avatar_url)
`;

function mapBookingRow(row: Record<string, unknown>): CourtBookingWithDetails {
  const court = Array.isArray(row.court) ? row.court[0] : row.court;
  const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
  const requester = Array.isArray(row.requester) ? row.requester[0] : row.requester;
  const { court: _c, plan: _p, requester: _r, ...booking } = row;

  const courtObj = court as Record<string, unknown> | null;
  const community = courtObj
    ? Array.isArray(courtObj.community)
      ? courtObj.community[0]
      : courtObj.community
    : null;

  return {
    ...(booking as CourtBookingWithDetails),
    court: courtObj
      ? {
          id: courtObj.id as string,
          name: courtObj.name as string,
          community_id: courtObj.community_id as string,
          community: community as CourtBookingWithDetails["court"] extends infer C
            ? C extends { community?: infer Co }
              ? Co
              : null
            : null,
        }
      : null,
    plan: (plan as CourtBookingWithDetails["plan"]) ?? null,
    requester: (requester as FeedProfile) ?? null,
  };
}

export type ManagedClubCourt = ClubCourt & {
  community?: { id: string; name: string; slug: string } | null;
};

export async function fetchManagedCourts(supabase: SupabaseClient, userId: string): Promise<ManagedClubCourt[]> {
  const { data: memberships, error: memErr } = await supabase
    .from("community_members")
    .select("community_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "moderator"]);

  if (memErr) throw new Error(memErr.message);

  const communityIds = (memberships ?? []).map((m) => m.community_id);
  if (communityIds.length === 0) return [];

  const { data, error } = await supabase
    .from("club_courts")
    .select(
      `
      *,
      community:communities(id, name, slug),
      plans:club_court_plans(id, court_id, label, unit_label, unit_minutes, price, is_active, sort_order),
      hours:club_court_hours(id, court_id, weekday, start_time, end_time)
    `
    )
    .in("community_id", communityIds)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const community = Array.isArray(row.community) ? row.community[0] : row.community;
    const plans = Array.isArray(row.plans) ? row.plans : row.plans ? [row.plans] : [];
    const hours = Array.isArray(row.hours) ? row.hours : row.hours ? [row.hours] : [];
    const { community: _c, plans: _p, hours: _h, ...court } = row;
    return { ...court, community, plans, hours } as ManagedClubCourt;
  });
}

export async function fetchManagedCourtBookings(
  supabase: SupabaseClient,
  status?: string[]
): Promise<CourtBookingWithDetails[]> {
  let query = supabase
    .from("club_court_bookings")
    .select(BOOKING_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status?.length) {
    query = query.in("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBookingRow(row as Record<string, unknown>));
}

export async function requestClubCourtBooking(
  supabase: SupabaseClient,
  courtId: string,
  planId: string,
  bookingDate: string,
  startTime: string,
  quantity: number
): Promise<{ bookingId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("request_club_court_booking", {
    p_court_id: courtId,
    p_plan_id: planId,
    p_booking_date: bookingDate,
    p_start_time: `${startTime}:00`,
    p_quantity: quantity,
  });

  if (error) return { bookingId: null, error: error.message };
  return { bookingId: data as string, error: null };
}

export async function reviewCourtBooking(
  supabase: SupabaseClient,
  bookingId: string,
  approve: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("owner_review_court_booking", {
    p_booking_id: bookingId,
    p_approve: approve,
  });
  return { error: error?.message ?? null };
}

export async function markCourtBookingPaid(
  supabase: SupabaseClient,
  bookingId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("owner_mark_court_booking_paid", {
    p_booking_id: bookingId,
  });
  return { error: error?.message ?? null };
}

export async function completeCourtBooking(
  supabase: SupabaseClient,
  bookingId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("owner_complete_court_booking", {
    p_booking_id: bookingId,
  });
  return { error: error?.message ?? null };
}

export async function cancelCourtBooking(
  supabase: SupabaseClient,
  bookingId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("owner_cancel_court_booking", {
    p_booking_id: bookingId,
  });
  return { error: error?.message ?? null };
}

export async function createManualCourtBooking(
  supabase: SupabaseClient,
  form: ManualCourtBookingForm
): Promise<{ bookingId: string | null; error: string | null }> {
  const quantity = parseInt(form.quantity, 10);
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { bookingId: null, error: "Quantidade inválida." };
  }
  if (!form.guest_name.trim()) {
    return { bookingId: null, error: "Informe o nome do cliente." };
  }

  const { data, error } = await supabase.rpc("owner_create_manual_court_booking", {
    p_court_id: form.court_id,
    p_plan_id: form.plan_id,
    p_booking_date: form.booking_date,
    p_start_time: `${form.start_time}:00`,
    p_quantity: quantity,
    p_guest_name: form.guest_name.trim(),
    p_guest_phone: form.guest_phone.trim() || null,
    p_notes: form.notes.trim() || null,
    p_mark_paid: form.mark_paid,
  });

  if (error) return { bookingId: null, error: error.message };
  return { bookingId: data as string, error: null };
}

export async function fetchCourtManagementStats(
  supabase: SupabaseClient,
  from?: string,
  to?: string
): Promise<CourtManagementStats> {
  const { data, error } = await supabase.rpc("court_management_stats", {
    p_from: from ?? null,
    p_to: to ?? null,
  });

  if (error) throw new Error(error.message);

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    listing_views: Number(row.listing_views ?? 0),
    bookings_count: Number(row.bookings_count ?? 0),
    total_revenue: Number(row.total_revenue ?? 0),
  };
}

export async function recordClubCourtListingView(
  supabase: SupabaseClient,
  courtId: string
): Promise<void> {
  await supabase.rpc("record_club_court_listing_view", { p_court_id: courtId });
}

export function emptyManualCourtBookingForm(courtId = "", planId = ""): ManualCourtBookingForm {
  return {
    court_id: courtId,
    plan_id: planId,
    booking_date: new Date().toISOString().slice(0, 10),
    start_time: "07:00",
    quantity: "1",
    guest_name: "",
    guest_phone: "",
    notes: "",
    mark_paid: true,
  };
}

export async function setCourtRentalAvailability(
  supabase: SupabaseClient,
  courtId: string,
  rentalAvailable: boolean,
  note?: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("club_courts")
    .update({
      rental_available: rentalAvailable,
      rental_unavailable_note: rentalAvailable ? null : (note?.trim() || null),
    })
    .eq("id", courtId);

  return { error: error?.message ?? null };
}

export const COURT_BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando aprovação",
  awaiting_payment: "Aguardando pagamento",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  rejected: "Recusado",
};
