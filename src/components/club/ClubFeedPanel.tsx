"use client";

import { useAppProfile } from "@/components/app/AppShell";
import { CreatePostBox } from "@/components/feed/CreatePostBox";
import { PostCard } from "@/components/feed/PostCard";
import type { CreatePostSubmitData } from "@/lib/createPost";
import type { FeedPost } from "@/types/feed";

type Props = {
  posts: FeedPost[];
  profileId: string;
  avatarUrl: string | null;
  username: string;
  posting: boolean;
  highlightPostId: string | null;
  highlightCommentId: string | null;
  onSubmitPost: (data: CreatePostSubmitData) => void | Promise<void>;
  onLikeToggle: (postId: string, liked: boolean) => void | Promise<void>;
  onEditPost?: (post: FeedPost) => void;
  onDeletePost?: (post: FeedPost) => void;
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
  onEditPost,
  onDeletePost,
}: Props) {
  const { display_name } = useAppProfile();

  return (
    <div className="mt-3 space-y-4 md:mt-4">
      <CreatePostBox
        avatarUrl={avatarUrl}
        username={username}
        displayName={display_name}
        loading={posting}
        context="community"
        allowMatch
        onSubmit={async (data) => {
          await onSubmitPost(data);
        }}
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[var(--toq-navy)]">Feed do clube</h2>
          <span className="text-[11px] font-semibold text-[var(--toq-text-muted)]">Mais recentes</span>
        </div>
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--toq-border)] bg-[var(--toq-surface)]/50 p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum post ainda</p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Publique o primeiro conteúdo visível apenas para membros do clube.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 md:space-y-4">
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
                  onEditPost={onEditPost}
                  onDeletePost={onDeletePost}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
