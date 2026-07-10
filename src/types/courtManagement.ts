import type { FeedProfile } from "@/types/feed";
import type { ClubCourtPlan } from "@/types/clubFeatures";

export type CourtRentalVisibility = "members_only" | "public";

export type FeedClubCourt = {
  id: string;
  name: string;
  community_id: string;
  contact_phone: string;
  rental_visibility: CourtRentalVisibility;
  rental_available?: boolean;
  rental_unavailable_note?: string | null;
  community_name?: string;
  community_slug?: string;
};
export type CourtBookingStatus =
  | "pending"
  | "awaiting_payment"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rejected";

export type CourtBooking = {
  id: string;
  club_court_id: string;
  plan_id: string | null;
  requester_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  quantity: number;
  total_price: number;
  status: CourtBookingStatus;
  is_manual: boolean;
  notes: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type CourtBookingWithDetails = CourtBooking & {
  court?: {
    id: string;
    name: string;
    community_id: string;
    community?: { id: string; name: string; slug: string } | null;
  } | null;
  plan?: ClubCourtPlan | null;
  requester?: FeedProfile | null;
};

export type CourtManagementStats = {
  listing_views: number;
  bookings_count: number;
  total_revenue: number;
};

export type ManualCourtBookingForm = {
  court_id: string;
  plan_id: string;
  booking_date: string;
  start_time: string;
  quantity: string;
  guest_name: string;
  guest_phone: string;
  notes: string;
  mark_paid: boolean;
};
