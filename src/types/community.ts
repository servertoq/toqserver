export type CommunityMemberRole = "owner" | "moderator" | "member";

export type Community = {
  id: string;
  name: string;
  slug: string;
  description: string;
  cover_image_url: string | null;
  is_private: boolean;
  member_count: number;
  accent_color: string;
  created_by: string | null;
  created_at: string;
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
