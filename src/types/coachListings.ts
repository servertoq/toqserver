export type CoachListing = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price_label: string;
  contact_whatsapp: string;
  post_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CoachListingWithProfile = CoachListing & {
  profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
};

export type CoachListingFormData = {
  title: string;
  description: string;
  price_label: string;
  contact_whatsapp: string;
};
