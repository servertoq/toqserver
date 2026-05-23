import type { AddressFields } from "@/lib/address";
import type { GenderType } from "@/lib/profile";

export type PublicProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  birth_date: string;
  gender: GenderType;
  created_at: string;
  post_count: number;
  friend_count: number;
  last_seen_at: string | null;
  address: AddressFields;
};
