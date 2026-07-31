/** @deprecated use proprietario — mantido para registros legados */
export type LegacyUserPlan = "empresario";

export type UserPlan =
  | "free"
  | "professor"
  | "promotor"
  | "proprietario"
  | "proprietario_plus"
  | LegacyUserPlan;

export type PlanUsage = {
  plan: UserPlan;
  stored_plan?: UserPlan;
  plan_active?: boolean;
  plan_activated_at?: string | null;
  plan_expires_at?: string | null;
  plan_billing_mode?: "pix" | "card_once" | "card_recurring" | null;
  show_plan_badge: boolean;
  communities_count: number;
  communities_max: number;
  clubs_count: number;
  clubs_max: number | null;
  coach_listings_count: number;
  coach_listings_max: number;
  courts_count: number;
  courts_max: number | null;
  can_create_coach_listing: boolean;
  can_create_club: boolean;
  can_create_court: boolean;
  can_create_community: boolean;
  can_create_standalone_tournament?: boolean;
  has_feed_boost?: boolean;
  feed_boost_hours?: number | null;
};

export type PlanInfo = {
  id: UserPlan;
  label: string;
  priceLabel: string | null;
  description: string;
};
