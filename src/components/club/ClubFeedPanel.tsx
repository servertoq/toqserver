"use client";

import { CreatePostBox } from "@/components/feed/CreatePostBox";
import { PostCard } from "@/components/feed/PostCard";
import type { FeedPost, PostType, PostVisibility } from "@/types/feed";

type Props = {
  posts: FeedPost[];
  profileId: string;
  avatarUrl: string | null;
  username: string;
  posting: boolean;
  highlightPostId: string | null;
  highlightCommentId: string | null;
  onSubmitPost: (data: {
    body: string;
    postType: PostType;
    title: string | null;
    visibility: PostVisibility;
    eventDate: string | null;
    eventTime: string | null;
    files: File[];
  }) => void | Promise<void>;
  onLikeToggle: (postId: string, liked: boolean) => void | Promise<void>;
};

export function ClubFeedPanel({
  posts,
  profileId,
  avatarUrl,
  username,
  posting,
  highlightPostId,
  highlightCommentId,
  onSubmitPost,
  onLikeToggle,
}: Props) {
  return (
    <div className="mt-4 space-y-4">
      <CreatePostBox
        avatarUrl={avatarUrl}
        username={username}
        loading={posting}
        context="community"
        onSubmit={async (data) => {
          await onSubmitPost(data);
        }}
      />

      <section>
        <h2 className="mb-3 text-sm font-bold text-[var(--toq-navy)]">Feed do clube</h2>
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum post ainda</p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Publique o primeiro conteúdo visível apenas para membros do clube.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  currentUserId={profileId}
                  highlightPost={post.id === highlightPostId}
                  highlightCommentId={post.id === highlightPostId ? highlightCommentId : null}
                  onLikeToggle={async (postId, liked) => {
                    await onLikeToggle(postId, liked);
                  }}
                  onCommentCountChange={() => {}}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
