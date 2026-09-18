export type OpenMatchFormat = "1v1" | "2v2" | "club";
export type OpenMatchStatus = "open" | "full" | "cancelled" | "done";
export type OpenMatchPlayerStatus = "confirmed" | "pending" | "rejected" | "invited";

export type OpenMatchListItem = {
  id: string;
  match_number: number;
  created_by: string;
  format: OpenMatchFormat;
  capacity: number;
  skill_level: number;
  court_name: string;
  city: string;
  community_id: string | null;
  community_name: string | null;
  community_cover_url: string | null;
  community_city: string | null;
  community_state: string | null;
  post_id: string | null;
  has_password: boolean;
  starts_at: string;
  status: OpenMatchStatus;
  notes: string;
  created_at: string;
  confirmed_count: number;
  pending_count: number;
  creator_username: string;
  creator_display_name: string | null;
  creator_avatar_url: string | null;
  viewer_is_member: boolean;
  day_use_allow_outsiders: boolean;
  day_use_price: number;
};

export type OpenMatchPlayer = {
  user_id: string;
  team: 1 | 2;
  status: OpenMatchPlayerStatus;
  day_use_accepted?: boolean;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type OpenMatchDetail = {
  id: string;
  match_number: number;
  created_by: string;
  format: OpenMatchFormat;
  capacity: number;
  skill_level: number;
  court_name: string;
  city: string;
  community_id: string | null;
  community_name: string | null;
  community_cover_url: string | null;
  community_city: string | null;
  community_state: string | null;
  post_id: string | null;
  has_password: boolean;
  starts_at: string;
  status: OpenMatchStatus;
  notes: string;
  created_at: string;
  creator_username: string;
  creator_display_name: string | null;
  creator_avatar_url: string | null;
  viewer_is_member: boolean;
  day_use_allow_outsiders: boolean;
  day_use_price: number;
  players: OpenMatchPlayer[];
};

export type CreateOpenMatchInput = {
  format: OpenMatchFormat;
  skillLevel: number;
  courtName: string;
  city: string;
  startsAt: string;
  password?: string;
  communityId?: string | null;
  notes?: string;
};

export type UpdateOpenMatchInput = {
  courtName: string;
  city: string;
  startsAt: string;
};
