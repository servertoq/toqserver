import type { FeedPost } from "@/types/feed";

const MONTH_LABELS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export type ProfileEngagementStats = {
  totalLikes: number;
  totalComments: number;
  engagementRate: number;
  monthlyActivity: { label: string; value: number }[];
};

export function computeEngagementStats(posts: FeedPost[]): ProfileEngagementStats {
  let totalLikes = 0;
  let totalComments = 0;

  for (const post of posts) {
    totalLikes += post.likes_count ?? 0;
    totalComments += post.comments_count ?? 0;
  }

  const interactions = totalLikes + totalComments;
  const engagementRate =
    posts.length === 0 ? 0 : Math.min(100, Math.round((interactions / posts.length) * 12));

  const now = new Date();
  const monthlyActivity: { label: string; value: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth();
    const year = d.getFullYear();
    const count = posts.filter((p) => {
      const created = new Date(p.created_at);
      return created.getMonth() === month && created.getFullYear() === year;
    }).length;
    monthlyActivity.push({ label: MONTH_LABELS[month], value: count });
  }

  const maxVal = Math.max(1, ...monthlyActivity.map((m) => m.value));
  const scaled = monthlyActivity.map((m) => ({
    label: m.label,
    value: Math.round((m.value / maxVal) * 100),
  }));

  return {
    totalLikes,
    totalComments,
    engagementRate,
    monthlyActivity: scaled,
  };
}
