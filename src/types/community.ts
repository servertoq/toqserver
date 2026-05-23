import type { DayHours } from "@/lib/operatingHours";

export type CommunityGroupKind = "community" | "club";

export type CommunityMemberRole = "owner" | "moderator" | "member";

export type CommunityAddress = {
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_complement: string | null;
  address_city: string | null;
  address_state: string | null;
};

export type Community = {
  id: string;
  name: string;
  slug: string;
  description: string;
  cover_image_url: string | null;
  is_private: boolean;
  kind: CommunityGroupKind;
  member_count: number;
  accent_color: string;
  created_by: string | null;
  created_at: string;
  operating_hours?: DayHours[] | unknown;
} & CommunityAddress;

export type CommunityInvite = {
  id: string;
  community_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  invitee?: { id: string; username: string; avatar_url: string | null };
};

export type CommunityMembership = {
  role: CommunityMemberRole;
  joined_at: string;
};

export type CommunityJoinRequest = {
  id: string;
  community_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  user?: { id: string; username: string; avatar_url: string | null };
};

export type CommunityMember = {
  user_id: string;
  role: CommunityMemberRole;
  joined_at: string;
  profile: { id: string; username: string; avatar_url: string | null };
};
