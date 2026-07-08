import type { SupabaseClient } from "@supabase/supabase-js";
import { mapMentionRows, resolveMentionUserIds, insertCommentMentions } from "@/lib/mentions";
import type { FeedComment } from "@/types/feed";

const COMMENT_SELECT = `
  id,
  body,
  created_at,
  parent_id,
  author:profiles!post_comments_author_id_fkey(id, username, avatar_url),
  mentions:comment_mentions(
    mentioned_user:profiles!comment_mentions_mentioned_user_id_fkey(id, username, avatar_url)
  )
`;

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  author: FeedComment["author"] | FeedComment["author"][];
  mentions: { mentioned_user: FeedComment["mentions"][0] | FeedComment["mentions"][0][] | null }[];
};

function mapCommentRow(
  row: CommentRow,
  likesByComment: Record<string, number>,
  likedSet: Set<string>
): FeedComment {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    parent_id: row.parent_id,
    author: author ?? { id: "", username: "?", avatar_url: null },
    mentions: mapMentionRows(row.mentions),
    likes_count: likesByComment[row.id] ?? 0,
    liked_by_me: likedSet.has(row.id),
    replies: [],
  };
}

export function buildCommentTree(flat: FeedComment[]): FeedComment[] {
  const byId = new Map(flat.map((c) => [c.id, { ...c, replies: [] as FeedComment[] }]));
  const roots: FeedComment[] = [];

  for (const c of byId.values()) {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.replies.push(c);
    } else if (!c.parent_id) {
      roots.push(c);
    }
  }

  return roots;
}

export async function fetchPostComments(
  supabase: SupabaseClient,
  postId: string,
  currentUserId: string
): Promise<FeedComment[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const rows = data as CommentRow[];
  const ids = rows.map((r) => r.id);
  const likesByComment: Record<string, number> = {};
  const likedSet = new Set<string>();

  if (ids.length > 0) {
    const { data: likes } = await supabase
      .from("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", ids);

    for (const l of likes ?? []) {
      likesByComment[l.comment_id] = (likesByComment[l.comment_id] ?? 0) + 1;
      if (l.user_id === currentUserId) likedSet.add(l.comment_id);
    }
  }

  return buildCommentTree(rows.map((r) => mapCommentRow(r, likesByComment, likedSet)));
}

export async function createComment(
  supabase: SupabaseClient,
  input: {
    postId: string;
    authorId: string;
    body: string;
    parentId?: string | null;
  }
): Promise<{ error: Error | null }> {
  const trimmed = input.body.trim();
  if (!trimmed) return { error: new Error("Comentário vazio") };

  const mentionIds = await resolveMentionUserIds(supabase, trimmed, input.authorId);

  const { data: comment, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: input.postId,
      author_id: input.authorId,
      body: trimmed,
      parent_id: input.parentId ?? null,
    })
    .select("id")
    .single();

  if (error || !comment) {
    return { error: error ?? new Error("Não foi possível comentar") };
  }

  const mentionErr = await insertCommentMentions(supabase, comment.id, mentionIds);
  if (mentionErr) {
    return { error: mentionErr };
  }

  return { error: null };
}

export async function toggleCommentLike(
  supabase: SupabaseClient,
  commentId: string,
  userId: string,
  liked: boolean
) {
  if (liked) {
    await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
  } else {
    await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
  }
}

export async function deleteOwnComment(
  supabase: SupabaseClient,
  commentId: string,
  authorId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", authorId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export function countAllComments(comments: FeedComment[]): number {
  let n = 0;
  function walk(list: FeedComment[]) {
    for (const c of list) {
      n += 1;
      walk(c.replies);
    }
  }
  walk(comments);
  return n;
}
