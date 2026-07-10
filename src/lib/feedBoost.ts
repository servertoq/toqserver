import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCoachListingsForPosts, mapPostRow } from "@/lib/feed";
import { normalizePlan } from "@/lib/billing/plans";
import { feedBoostIntervalHours, planHasFeedBoost } from "@/lib/plans";
import { POST_SELECT } from "@/lib/posts";
import { enrichPostsWithStaffRoles } from "@/lib/staff";
import type { FeedPost } from "@/types/feed";
import type { UserPlan } from "@/types/plans";

function boostIntervalMs(plan: UserPlan) {
  const hours = feedBoostIntervalHours(plan);
  if (!hours) return null;
  return hours * 60 * 60 * 1000;
}

export async function loadBoostedFeedPosts(
  supabase: SupabaseClient,
  viewerId: string,
  excludePostIds: Set<string>
): Promise<FeedPost[]> {
  const { data: candidates, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .is("community_id", null)
    .eq("visibility", "public")
    .neq("author_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !candidates?.length) return [];

  const eligible = candidates.filter((row) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    const plan = normalizePlan((author?.plan as UserPlan) ?? "free");
    return planHasFeedBoost(plan);
  });

  if (eligible.length === 0) return [];

  const postIds = eligible.map((p) => p.id as string);
  const { data: impressions } = await supabase
    .from("post_boost_impressions")
    .select("post_id, last_shown_at")
    .eq("user_id", viewerId)
    .in("post_id", postIds);

  const lastShown = new Map(
    (impressions ?? []).map((i) => [i.post_id as string, new Date(i.last_shown_at as string).getTime()])
  );

  const now = Date.now();
  const due = eligible.filter((row) => {
    if (excludePostIds.has(row.id as string)) return false;
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    const plan = normalizePlan((author?.plan as UserPlan) ?? "free");
    const interval = boostIntervalMs(plan);
    if (!interval) return false;
    const seen = lastShown.get(row.id as string);
    return !seen || now - seen >= interval;
  });

  if (due.length === 0) return [];

  const dueIds = due.map((p) => p.id as string);
  const likesByPost: Record<string, number> = {};
  const commentsByPost: Record<string, number> = {};
  const likedSet = new Set<string>();

  const { data: likes } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", dueIds);

  for (const row of likes ?? []) {
    likesByPost[row.post_id] = (likesByPost[row.post_id] ?? 0) + 1;
    if (row.user_id === viewerId) likedSet.add(row.post_id);
  }

  const { data: comments } = await supabase
    .from("post_comments")
    .select("post_id")
    .in("post_id", dueIds);

  for (const row of comments ?? []) {
    commentsByPost[row.post_id] = (commentsByPost[row.post_id] ?? 0) + 1;
  }

  const coachListingsByPostId = await fetchCoachListingsForPosts(supabase, dueIds);

  const mapped = due.map((row) => ({
    ...mapPostRow(
      row as Parameters<typeof mapPostRow>[0],
      likesByPost[row.id as string] ?? 0,
      commentsByPost[row.id as string] ?? 0,
      likedSet.has(row.id as string),
      new Set(coachListingsByPostId.keys()),
      coachListingsByPostId
    ),
    is_boosted: true,
  }));

  return enrichPostsWithStaffRoles(supabase, mapped);
}

export function mergeBoostedIntoFeed(regular: FeedPost[], boosted: FeedPost[]): FeedPost[] {
  if (boosted.length === 0) return regular;

  const seen = new Set(regular.map((p) => p.id));
  const uniqueBoosted = boosted.filter((p) => !seen.has(p.id));
  if (uniqueBoosted.length === 0) return regular;

  const result: FeedPost[] = [];
  let boostIdx = 0;
  const interval = 4;

  for (let i = 0; i < regular.length; i++) {
    result.push(regular[i]);
    if ((i + 1) % interval === 0 && boostIdx < uniqueBoosted.length) {
      result.push(uniqueBoosted[boostIdx]);
      boostIdx++;
    }
  }

  while (boostIdx < uniqueBoosted.length) {
    result.push(uniqueBoosted[boostIdx]);
    boostIdx++;
  }

  return result;
}

export async function recordBoostImpression(supabase: SupabaseClient, postId: string) {
  await supabase.rpc("record_post_boost_impression", { p_post_id: postId });
}
