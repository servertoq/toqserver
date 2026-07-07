import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedProfile } from "@/types/feed";

const MENTION_RE = /@([a-zA-Z0-9_]{3,})/g;

export function extractMentionUsernames(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

export async function resolveMentionUserIds(
  supabase: SupabaseClient,
  body: string,
  excludeUserId?: string
): Promise<string[]> {
  const names = extractMentionUsernames(body);
  if (names.length === 0) return [];

  const { data, error } = await supabase.rpc("get_profile_ids_by_usernames", {
    p_usernames: names,
  });

  if (error || !data) return [];

  const rows = data as { id: string; username: string }[];
  return rows
    .map((r) => r.id)
    .filter((id) => id !== excludeUserId)
    .filter((id, i, arr) => arr.indexOf(id) === i);
}

export async function insertPostMentions(
  supabase: SupabaseClient,
  postId: string,
  userIds: string[]
) {
  if (userIds.length === 0) return;
  await supabase.from("post_mentions").insert(
    userIds.map((mentioned_user_id) => ({ post_id: postId, mentioned_user_id }))
  );
}

export async function syncPostMentions(
  supabase: SupabaseClient,
  postId: string,
  userIds: string[]
) {
  await supabase.from("post_mentions").delete().eq("post_id", postId);
  await insertPostMentions(supabase, postId, userIds);
}

export async function insertCommentMentions(
  supabase: SupabaseClient,
  commentId: string,
  userIds: string[]
) {
  if (userIds.length === 0) return null;
  const { error } = await supabase.from("comment_mentions").insert(
    userIds.map((mentioned_user_id) => ({ comment_id: commentId, mentioned_user_id }))
  );
  return error;
}

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; username: string };

export function parseBodySegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) {
      segments.push({ type: "text", value: body.slice(last, idx) });
    }
    segments.push({ type: "mention", username: match[1] });
    last = idx + match[0].length;
  }
  if (last < body.length) {
    segments.push({ type: "text", value: body.slice(last) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: body }];
}

export function mapMentionRows(
  rows: { mentioned_user: FeedProfile | FeedProfile[] | null }[] | null | undefined
): FeedProfile[] {
  return (rows ?? [])
    .map((r) => {
      const u = Array.isArray(r.mentioned_user) ? r.mentioned_user[0] : r.mentioned_user;
      return u ?? null;
    })
    .filter((u): u is FeedProfile => u !== null);
}
