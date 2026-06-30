export type ClubRecommendationStatus = "pending" | "contacted" | "added" | "dismissed";

export type ClubRecommendation = {
  id: string;
  user_id: string;
  club_name: string;
  contact: string;
  notes: string;
  status: ClubRecommendationStatus;
  created_at: string;
};

export type ClubRecommendationWithReporter = ClubRecommendation & {
  reporter: {
    id: string;
    username: string;
    avatar_url: string | null;
    email: string | null;
  } | null;
};
