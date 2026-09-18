import type { FeedClubCourt } from "@/types/courtManagement";

export type PostType =
  | "player"
  | "event"
  | "poll"
  | "coach"
  | "court"
  | "partida"
  | "match_result";

export type PostVisibility = "public" | "private" | "participants";

export type PostPollOption = {
  id: string;
  label: string;
  sort_order: number;
};

export type PostPollMeta = {
  allow_multiple: boolean;
  show_results_to_all: boolean;
  options: PostPollOption[];
};

import type { StaffRole } from "@/types/staff";

export type FeedProfile = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url: string | null;
  plan?: "free" | "professor" | "promotor" | "proprietario" | "proprietario_plus" | "empresario";
  show_plan_badge?: boolean;
  staff_role?: StaffRole | null;
};

export type FeedCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string;
  member_count: number;
  accent_color: string;
  created_by?: string | null;
};

export type PostImage = {
  url: string;
  sort_order: number;
  media_type?: "image" | "video";
};

export type FeedCoachListing = {
  id: string;
  user_id: string;
  title: string;
  price_label: string;
  contact_whatsapp: string;
};

export type MatchResultPlayer = {
  user_id: string;
  team: 1 | 2;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  skill_label: string;
};

export type MatchResultPayload = {
  result_id: string;
  open_match_id: string;
  format: "1v1" | "2v2" | "club";
  team1_score: number;
  team2_score: number;
  share_scope: "participants" | "general";
  community_id: string | null;
  location_label: string;
  played_at: string;
  players: MatchResultPlayer[];
};

export type FeedPost = {
  id: string;
  body: string;
  title: string | null;
  post_type: PostType;
  created_at: string;
  community_id: string | null;
  visibility: PostVisibility;
  event_date: string | null;
  event_time: string | null;
  mentions: FeedProfile[];
  author: FeedProfile;
  images: PostImage[];
  community: Pick<FeedCommunity, "name" | "slug" | "accent_color" | "created_by"> | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  poll: PostPollMeta | null;
  match_capacity: number | null;
  match_result?: MatchResultPayload | null;
  is_boosted?: boolean;
  is_coach_listing?: boolean;
  coach_listing?: FeedCoachListing | null;
  is_club_court?: boolean;
  club_court?: FeedClubCourt | null;
};

export type FeedComment = {
  id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  author: FeedProfile;
  mentions: FeedProfile[];
  likes_count: number;
  liked_by_me: boolean;
  replies: FeedComment[];
};
