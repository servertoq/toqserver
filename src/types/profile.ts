import type { AddressFields } from "@/lib/address";
import type { GenderType, PlayerLevelType } from "@/lib/profile";
import type { UserPlan } from "@/types/plans";
import type { StaffRole } from "@/types/staff";

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string;
  birth_date: string;
  gender: GenderType;
  player_level: PlayerLevelType;
  plan: UserPlan;
  staff_role: StaffRole | null;
  created_at: string;
  post_count: number;
  friend_count: number;
  club_count: number;
  last_seen_at: string | null;
  address: AddressFields;
};
