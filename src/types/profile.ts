import type { AddressFields } from "@/lib/address";
import type {
  DominantHand,
  ExperienceBand,
  FavoriteCourt,
  GenderType,
  PlayFrequency,
  PlayerLevelType,
  PlayStyle,
} from "@/lib/profile";
import type { UserPlan } from "@/types/plans";
import type { StaffRole } from "@/types/staff";

export type ProfilePhoto = {
  id: string;
  user_id: string;
  url: string;
  sort_order: number;
  created_at?: string;
};

export type ProfileGameFields = {
  dominant_hand: DominantHand | null;
  experience_band: ExperienceBand | null;
  play_frequency: PlayFrequency | null;
  play_style: PlayStyle | null;
  favorite_court: FavoriteCourt | null;
};

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
} & ProfileGameFields;

export type ProfileFriendPreview = {
  friend_id: string;
  username: string;
  avatar_url: string | null;
};

export type ProfileClubPreview = {
  community_id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
  kind: "club" | "community";
  joined_at: string | null;
};
