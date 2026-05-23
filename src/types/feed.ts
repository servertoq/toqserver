export type PostType = "player" | "event";

export type PostVisibility = "public" | "private";

export type FeedProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export type FeedCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string;
  member_count: number;
  accent_color: string;
};

export type PostImage = {
  url: string;
  sort_order: number;
  media_type?: "image" | "video";
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
  community: Pick<FeedCommunity, "name" | "slug" | "accent_color"> | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
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
