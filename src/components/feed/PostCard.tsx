"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatTimeAgo, postTypeLabel } from "@/lib/feed";
import { profilePath } from "@/lib/publicProfile";
import { formatEventSchedule } from "@/lib/posts";
import { visibilityBadgeLabel } from "@/lib/postVisibility";
import type { FeedPost } from "@/types/feed";
import { CommentsPanel } from "./CommentsPanel";
import { PostBody } from "./PostBody";
import { PostMediaGrid } from "./PostMediaGrid";

type Props = {
  post: FeedPost;
  currentUserId: string;
  onLikeToggle: (postId: string, liked: boolean) => Promise<void>;
  onCommentCountChange: (postId: string, delta: number) => void;
  highlightPost?: boolean;
  highlightCommentId?: string | null;
};

export function PostCard({
  post,
  currentUserId,
  onLikeToggle,
  onCommentCountChange,
  highlightPost = false,
  highlightCommentId = null,
}: Props) {
  const articleRef = useRef<HTMLElement>(null);
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showComments, setShowComments] = useState(!!highlightCommentId);
  const [likeLoading, setLikeLoading] = useState(false);
  const visBadge = visibilityBadgeLabel(post.visibility, !!post.community_id);

  useEffect(() => {
    if (highlightPost && articleRef.current) {
      articleRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightPost]);

  useEffect(() => {
    if (highlightCommentId) setShowComments(true);
  }, [highlightCommentId]);

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
    <article
      ref={articleRef}
      id={`post-${post.id}`}
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        highlightPost
          ? "border-[var(--toq-lime-light)] ring-2 ring-[var(--toq-lime-light)]"
          : "border-slate-200"
      }`}
    >
      <header className="mb-3 flex items-start gap-3">
        <PostAvatar src={post.author.avatar_url} name={post.author.username} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={profilePath(post.author.username)}
              className="font-bold text-[var(--toq-navy)] hover:text-[var(--toq-sky)]"
            >
              {post.author.username}
            </Link>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                post.post_type === "event"
                  ? "bg-[var(--toq-sky)]/15 text-[var(--toq-sky)]"
                  : "bg-slate-100 text-[var(--toq-text-muted)]"
              }`}
            >
              {postTypeLabel(post.post_type)}
            </span>
            {visBadge && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {visBadge}
              </span>
            )}
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
      {post.post_type === "event" && (post.event_date || post.event_time) && (
        <p className="mb-2 text-xs font-semibold text-[var(--toq-sky)]">
          📅 {formatEventSchedule(post.event_date, post.event_time)}
        </p>
      )}
      <PostBody body={post.body} />
      {post.mentions.length > 0 && (
        <p className="mt-2 text-[10px] text-[var(--toq-text-muted)]">
          Mencionados:{" "}
          {post.mentions.map((m, i) => (
            <span key={m.id}>
              {i > 0 ? ", " : null}
              <Link
                href={profilePath(m.username)}
                className="font-semibold text-[var(--toq-sky)] hover:underline"
              >
                @{m.username}
              </Link>
            </span>
          ))}
        </p>
      )}

      <PostMediaGrid items={post.images} />

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
          highlightCommentId={highlightCommentId}
          defaultOpen={!!highlightCommentId}
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
