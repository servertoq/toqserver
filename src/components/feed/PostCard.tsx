"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordBoostImpression } from "@/lib/feedBoost";
import { formatTimeAgo, postTypeLabel } from "@/lib/feed";
import { profileDisplayName } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";
import { formatEventSchedule } from "@/lib/posts";
import { visibilityBadgeLabel } from "@/lib/postVisibility";
import type { FeedCoachListing, FeedPost } from "@/types/feed";
import { CoachListingPostActions } from "@/components/coach/CoachListingPostActions";
import { CourtListingPostActions } from "@/components/court/CourtListingPostActions";
import { CommentsPanel } from "./CommentsPanel";
import { PostBody } from "./PostBody";
import { PostMediaGrid } from "./PostMediaGrid";
import { PollBlock } from "./PollBlock";
import { PostOwnerMenu } from "./PostOwnerMenu";
import { ReportButton } from "@/components/report/ReportButton";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { StaffBadge } from "@/components/shared/StaffBadge";
import { canShowPlanBadge } from "@/lib/plans";

type Props = {
  post: FeedPost;
  currentUserId: string;
  onLikeToggle: (postId: string, liked: boolean) => Promise<void>;
  onCommentCountChange: (postId: string, delta: number) => void;
  highlightPost?: boolean;
  highlightCommentId?: string | null;
  fullBleed?: boolean;
  onEditPost?: (post: FeedPost) => void;
  onDeletePost?: (post: FeedPost) => void;
  enrolledCoachListingIds?: Set<string>;
  onEnrollCoachListing?: (listing: FeedCoachListing) => void;
};

export function PostCard({
  post,
  currentUserId,
  onLikeToggle,
  onCommentCountChange,
  highlightPost = false,
  highlightCommentId = null,
  fullBleed = false,
  onEditPost,
  onDeletePost,
  enrolledCoachListingIds,
  onEnrollCoachListing,
}: Props) {
  const articleRef = useRef<HTMLElement>(null);
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showComments, setShowComments] = useState(!!highlightCommentId);
  const [likeLoading, setLikeLoading] = useState(false);
  const isCoachPost = post.post_type === "coach" || post.is_coach_listing;
  const isClubCourtPost = post.post_type === "court" || post.is_club_court;
  const visBadge = visibilityBadgeLabel(post.visibility, !!post.community_id);
  const isAuthor = post.author.id === currentUserId;
  const isCoachListingPost = !!post.coach_listing || isCoachPost;
  const isCourtListingPost = !!post.club_court || isClubCourtPost;
  const canManage = isAuthor && onEditPost && onDeletePost && !isCoachListingPost && !isCourtListingPost;

  useEffect(() => {
    if (highlightPost && articleRef.current) {
      articleRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightPost]);

  useEffect(() => {
    if (highlightCommentId) setShowComments(true);
  }, [highlightCommentId]);

  useEffect(() => {
    if (!post.is_boosted || isAuthor) return;
    const el = articleRef.current;
    if (!el) return;

    const supabase = createClient();
    let recorded = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (recorded) return;
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4);
        if (visible) {
          recorded = true;
          void recordBoostImpression(supabase, post.id);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id, post.is_boosted, isAuthor]);

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
      className={
        fullBleed
          ? `post-card post-card--bleed bg-white border-b border-slate-200 md:rounded-2xl md:border md:p-4 md:shadow-sm ${
              highlightPost
                ? "ring-2 ring-inset ring-[var(--toq-accent-soft)] md:ring-[var(--toq-accent-soft)]"
                : "md:border-slate-200"
            }`
          : `rounded-2xl border bg-white p-4 shadow-sm ${
              highlightPost
                ? "border-[var(--toq-accent)] ring-2 ring-[var(--toq-accent-soft)]"
                : "border-slate-200"
            }`
      }
    >
      <header
        className={`flex items-start gap-3 ${
          fullBleed ? "post-card__header mb-0 px-4 py-3 md:mb-3 md:px-0 md:py-0" : "mb-3"
        }`}
      >
        <PostAvatar src={post.author.avatar_url} name={post.author.username} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={profilePath(post.author.username)}
              className="font-bold text-[var(--toq-navy)] hover:text-[var(--toq-sky)]"
            >
              {profileDisplayName(post.author)}
            </Link>
            <StaffBadge role={post.author.staff_role} />
            <PlanBadge
              plan={post.author.plan ?? "free"}
              show={!isCoachPost && canShowPlanBadge(post.author.plan, post.author.show_plan_badge)}
            />
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                post.post_type === "event"
                  ? "bg-[var(--toq-sky)]/15 text-[var(--toq-sky)]"
                  : post.post_type === "poll"
                    ? "bg-violet-100 text-violet-700"
                    : isCoachPost
                      ? "bg-emerald-100 text-emerald-800"
                      : isClubCourtPost
                        ? "bg-sky-100 text-sky-800"
                        : "bg-slate-100 text-[var(--toq-text-muted)]"
              }`}
            >
              {isCoachPost ? "Professor" : isClubCourtPost ? "Quadra" : postTypeLabel(post.post_type)}
            </span>
            {visBadge && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {visBadge}
              </span>
            )}
            {post.is_boosted && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                Destaque
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
        {canManage ? (
          <PostOwnerMenu
            onEdit={() => onEditPost(post)}
            onDelete={() => onDeletePost(post)}
          />
        ) : !isAuthor ? (
          <ReportButton
            userId={currentUserId}
            target={{
              type: "post",
              id: post.id,
              label: `publicação de @${post.author.username}`,
            }}
            compact
          />
        ) : null}
      </header>

      <div className={fullBleed ? "post-card__body px-4 pb-3 md:px-0 md:pb-0" : undefined}>
      {post.title && (
        <h3 className="mb-2 text-base font-bold text-[var(--toq-navy)]">{post.title}</h3>
      )}
      {post.post_type === "event" && (post.event_date || post.event_time) && (
        <p className="mb-2 text-xs font-semibold text-[var(--toq-sky)]">
          📅 {formatEventSchedule(post.event_date, post.event_time)}
        </p>
      )}
      {post.post_type === "poll" ? (
        <p className="mb-1 text-base font-bold text-[var(--toq-navy)]">{post.body}</p>
      ) : (
        <PostBody body={post.body} />
      )}
      {post.coach_listing && (
        <CoachListingPostActions
          listing={post.coach_listing}
          coachUsername={post.author.username}
          enrolled={enrolledCoachListingIds?.has(post.coach_listing.id)}
          onEnroll={() => onEnrollCoachListing?.(post.coach_listing!)}
        />
      )}
      {post.club_court && <CourtListingPostActions court={post.club_court} />}
      {post.post_type === "poll" && (
        <PollBlock postId={post.id} isAuthor={post.author.id === currentUserId} />
      )}
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
      </div>

      <PostMediaGrid items={post.images} fullBleed={fullBleed} />

      <div
        className={`flex items-center gap-4 ${
          fullBleed
            ? "post-card__actions border-t border-slate-100 px-4 py-3 md:mt-3 md:px-0 md:py-0 md:pt-3"
            : "mt-3 border-t border-slate-100 pt-3"
        }`}
      >
        <button
          type="button"
          disabled={likeLoading}
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm font-semibold transition ${
            liked ? "text-[var(--toq-accent)]" : "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]"
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
        <div className={fullBleed ? "px-4 pb-3 md:px-0 md:pb-0" : undefined}>
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
        </div>
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
