"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mapPostRow } from "@/lib/feed";
import type { FeedPost, PostType, PostVisibility } from "@/types/feed";
import { useAppProfile } from "@/components/app/AppShell";
import { FeedPageGrid } from "./FeedPageGrid";
import { FeedSidebar } from "./FeedSidebar";
import { createPostWithMedia, POST_SELECT } from "@/lib/posts";
import { CreatePostBox } from "./CreatePostBox";
import { FeedTopBar } from "./FeedTopBar";
import { PostCard } from "./PostCard";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { FloatingMessages } from "@/components/messages/FloatingMessages";

export function FeedPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const searchParams = useSearchParams();
  const highlightPostId = searchParams.get("post");
  const highlightCommentId = searchParams.get("comment");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSubmitting: posting, guard: guardPost } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: rawPosts, error: postsErr } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .or("community_id.is.null,and(community_id.not.is.null,visibility.eq.public)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (postsErr) {
      setError(
        "Não foi possível carregar o feed. Execute as migrations do Supabase."
      );
      setLoading(false);
      return;
    }

    const postIds = (rawPosts ?? []).map((p) => p.id);
    const likesByPost: Record<string, number> = {};
    const commentsByPost: Record<string, number> = {};
    const likedSet = new Set<string>();

    if (postIds.length > 0) {
      const { data: likes } = await supabase
        .from("post_likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      for (const row of likes ?? []) {
        likesByPost[row.post_id] = (likesByPost[row.post_id] ?? 0) + 1;
        if (row.user_id === user.id) likedSet.add(row.post_id);
      }

      const { data: comments } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      for (const row of comments ?? []) {
        commentsByPost[row.post_id] = (commentsByPost[row.post_id] ?? 0) + 1;
      }
    }

    setPosts(
      (rawPosts ?? []).map((row) =>
        mapPostRow(
          row,
          likesByPost[row.id] ?? 0,
          commentsByPost[row.id] ?? 0,
          likedSet.has(row.id)
        )
      )
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  async function handleCreatePost(data: {
    body: string;
    postType: PostType;
    title: string | null;
    visibility: PostVisibility;
    eventDate: string | null;
    eventTime: string | null;
    files: File[];
  }) {
    if (!profile || posting) return;

    await guardPost(async () => {
      setError(null);
      const { error: createErr } = await createPostWithMedia(supabase, {
        authorId: profile.id,
        body: data.body,
        postType: data.postType,
        title: data.title,
        visibility: data.visibility,
        communityId: null,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        files: data.files,
      });

      if (createErr) {
        setError(createErr);
        return;
      }

      await loadFeed();
    });
  }

  async function handleLikeToggle(postId: string, liked: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (liked) {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    } else {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-sm text-[var(--toq-text-muted)]">Carregando feed…</p>
      </div>
    );
  }

  return (
    <>
      <FeedTopBar showOnlineFriends />
      <FeedPageGrid className="py-6" sidebar={<FeedSidebar />} pinSidebar>
        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <CreatePostBox
          avatarUrl={profile.avatar_url}
          username={profile.username}
          loading={posting}
          context="global"
          onSubmit={handleCreatePost}
        />

        <section>
          <h2 className="toq-section-label mb-3">Feed geral</h2>
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum post ainda</p>
              <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
                Publique o primeiro — eventos, treinos ou novidades. Posts de comunidades ficam no menu Comunidade.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li key={post.id}>
                  <PostCard
                    post={post}
                    currentUserId={profile!.id}
                    highlightPost={post.id === highlightPostId}
                    highlightCommentId={
                      post.id === highlightPostId ? highlightCommentId : null
                    }
                    onLikeToggle={handleLikeToggle}
                    onCommentCountChange={() => {}}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </FeedPageGrid>
      <FloatingMessages />
    </>
  );
}
