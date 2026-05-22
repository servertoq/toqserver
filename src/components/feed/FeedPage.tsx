"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapPostRow } from "@/lib/feed";
import type { FeedCommunity, FeedPost } from "@/types/feed";
import type { PostType } from "@/types/feed";
import { useAppProfile } from "@/components/app/AppShell";
import { CommunityStrip } from "./CommunityStrip";
import { CreatePostBox } from "./CreatePostBox";
import { FeedTopBar } from "./FeedTopBar";
import { PostCard } from "./PostCard";

export function FeedPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const [communities, setCommunities] = useState<FeedCommunity[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
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

    const { data: comms } = await supabase
      .from("communities")
      .select("*")
      .order("member_count", { ascending: false });

    setCommunities((comms as FeedCommunity[]) ?? []);

    const { data: rawPosts, error: postsErr } = await supabase
      .from("posts")
      .select(
        `
        id,
        body,
        title,
        post_type,
        created_at,
        community_id,
        author:profiles!posts_author_id_fkey(id, username, avatar_url),
        images:post_images(url, sort_order),
        communities(name, slug, accent_color)
      `
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (postsErr) {
      setError(
        "Não foi possível carregar o feed. Execute a migration 002_feed_social.sql no Supabase."
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
    files: File[];
  }) {
    if (!profile) return;
    setPosting(true);
    setError(null);

    try {
      const { data: newPost, error: insertErr } = await supabase
        .from("posts")
        .insert({
          author_id: profile.id,
          body: data.body,
          post_type: data.postType,
          title: data.title,
        })
        .select("id")
        .single();

      if (insertErr || !newPost) {
        setError("Não foi possível publicar. Tente novamente.");
        return;
      }

      const imageRows: { post_id: string; url: string; sort_order: number }[] = [];

      for (let i = 0; i < data.files.length; i++) {
        const file = data.files[i];
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${profile.id}/${newPost.id}/${Date.now()}-${i}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("post-images")
          .upload(path, file, { upsert: false, contentType: file.type });

        if (uploadErr) continue;

        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        imageRows.push({ post_id: newPost.id, url: urlData.publicUrl, sort_order: i });
      }

      if (imageRows.length > 0) {
        await supabase.from("post_images").insert(imageRows);
      }

      await loadFeed();
    } finally {
      setPosting(false);
    }
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
      <FeedTopBar />
      <main className="mx-auto max-w-2xl px-4 py-6 md:max-w-3xl md:px-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <CreatePostBox
          avatarUrl={profile.avatar_url}
          username={profile.username}
          loading={posting}
          onSubmit={handleCreatePost}
        />

        <CommunityStrip communities={communities} />

        <section>
          <h2 className="mb-3 text-sm font-bold text-[var(--toq-navy)]">Feed</h2>
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum post ainda</p>
              <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
                Publique o primeiro — eventos, treinos ou novidades para a comunidade.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li key={post.id}>
                  <PostCard
                    post={post}
                    currentUserId={profile!.id}
                    onLikeToggle={handleLikeToggle}
                    onCommentCountChange={() => {}}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
