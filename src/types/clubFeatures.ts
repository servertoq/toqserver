export type ClubProductImage = {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
};

export type ClubProductVariant = {
  id: string;
  product_id: string;
  size_label: string | null;
  color: string | null;
  numbering: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
};

export type ClubProduct = {
  id: string;
  community_id: string;
  name: string;
  description: string;
  size_label: string | null;
  color: string | null;
  numbering: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
  images?: ClubProductImage[];
  variants?: ClubProductVariant[];
};

export type ClubCartItem = {
  productId: string;
  variantId: string;
  productName: string;
  size_label: string | null;
  color: string | null;
  numbering: string | null;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

export type ClubRankingCategory = {
  id: string;
  community_id: string;
  name: string;
  unit_label: string;
  description: string | null;
  sort_order: number;
};

export type ClubRankingEntry = {
  id: string;
  category_id: string;
  user_id: string;
  score: number;
  notes: string | null;
  profile?: { id: string; username: string; avatar_url: string | null };
};

export type ClubCourtImage = {
  id: string;
  court_id: string;
  url: string;
  sort_order: number;
};

export type ClubCourtPlan = {
  id: string;
  court_id: string;
  label: string;
  unit_label: string;
  unit_minutes: number;
  price: number;
  is_active: boolean;
  sort_order: number;
};

export type ClubCourtHours = {
  id: string;
  court_id: string;
  weekday: number; // 0=domingo ... 6=sábado
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
};

export type ClubCourtBlock = {
  id: string;
  court_id: string;
  start_ts: string;
  end_ts: string;
  reason: string | null;
};

export type ClubCourt = {
  id: string;
  community_id: string;
  name: string;
  size_label: string;
  description: string;
  contact_phone: string;
  is_active: boolean;
  sort_order: number;
  rental_visibility?: "members_only" | "public";
  rental_available?: boolean;
  rental_unavailable_note?: string | null;
  post_id?: string | null;
  images?: ClubCourtImage[];
  plans?: ClubCourtPlan[];
  hours?: ClubCourtHours[];
  blocks?: ClubCourtBlock[];
};

export type ClubTournament = {
  id: string;
  community_id: string;
  name: string;
  description: string;
  how_it_works: string;
  prizes: string;
  contact_whatsapp: string;
  image_url: string | null;
  is_private: boolean;
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  community?: {
    id: string;
    name: string;
    slug: string;
    cover_image_url: string | null;
  };
};

export type ClubTab = "feed" | "shop" | "ranking" | "courts" | "tournaments";

export type VariantDraft = {
  key: string;
  size_label: string;
  color: string;
  numbering: string;
  priceStr: string;
};
