/** @deprecated use proprietario — mantido para registros legados */
export type LegacyUserPlan = "empresario";

export type UserPlan =
  | "free"
  | "professor"
  | "proprietario"
  | "proprietario_plus"
  | LegacyUserPlan;

export type PlanUsage = {
  plan: UserPlan;
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
  has_feed_boost?: boolean;
  feed_boost_hours?: number | null;
};

export type PlanInfo = {
  id: UserPlan;
  label: string;
  priceLabel: string | null;
  description: string;
};
