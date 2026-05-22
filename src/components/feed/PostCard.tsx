"use client";

import { useState } from "react";
import { formatTimeAgo, postTypeLabel } from "@/lib/feed";
import type { FeedPost } from "@/types/feed";
import { CommentsPanel } from "./CommentsPanel";

type Props = {
  post: FeedPost;
  currentUserId: string;
  onLikeToggle: (postId: string, liked: boolean) => Promise<void>;
  onCommentCountChange: (postId: string, delta: number) => void;
};

export function PostCard({ post, currentUserId, onLikeToggle, onCommentCountChange }: Props) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showComments, setShowComments] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  async function handleLike() {
    setLikeLoading(true);
    const next = !liked;
    setLiked(next);
    setLikesCount((c) => c + (next ? 1 : -1));
    try {
      await onLikeToggle(post.id, next);
    } catch {
      setLiked(!next);
      setLikesCount((c) => c + (next ? -1 : 1));
    }
    setLikeLoading(false);
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-start gap-3">
        <PostAvatar src={post.author.avatar_url} name={post.author.username} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[var(--toq-navy)]">{post.author.username}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                post.post_type === "event"
                  ? "bg-[var(--toq-sky)]/15 text-[var(--toq-sky)]"
                  : "bg-slate-100 text-[var(--toq-text-muted)]"
              }`}
            >
              {postTypeLabel(post.post_type)}
            </span>
            <span className="text-xs text-[var(--toq-text-muted)]">
              {formatTimeAgo(post.created_at)}
            </span>
          </div>
          {post.community && (
            <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
              em <span className="font-semibold text-[var(--toq-navy)]">{post.community.name}</span>
            </p>
          )}
        </div>
      </header>

      {post.title && (
        <h3 className="mb-2 text-base font-bold text-[var(--toq-navy)]">{post.title}</h3>
      )}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--toq-text)]">
        {post.body}
      </p>

      {post.images.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${
            post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {post.images.map((img) => (
            <div
              key={img.url}
              className={`overflow-hidden rounded-lg bg-slate-100 ${
                post.images.length === 1 ? "max-h-80" : "aspect-square"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className={`h-full w-full object-cover ${
                  post.images.length === 1 ? "max-h-80 w-full" : ""
                }`}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
        <button
          type="button"
          disabled={likeLoading}
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm font-semibold transition ${
            liked ? "text-[var(--toq-lime-dark)]" : "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]"
          }`}
        >
          <span aria-hidden>{liked ? "♥" : "♡"}</span>
          {likesCount > 0 && <span>{likesCount}</span>}
          <span className="sr-only">Curtir</span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--toq-text-muted)] transition hover:text-[var(--toq-navy)]"
        >
          <span aria-hidden>💬</span>
          {commentsCount > 0 && <span>{commentsCount}</span>}
          Comentar
        </button>
      </div>

      {showComments && (
        <CommentsPanel
          postId={post.id}
          currentUserId={currentUserId}
          onCommentAdded={() => {
            setCommentsCount((c) => c + 1);
            onCommentCountChange(post.id, 1);
          }}
        />
      )}
    </article>
  );
}

function PostAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--toq-sky)] text-sm font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
