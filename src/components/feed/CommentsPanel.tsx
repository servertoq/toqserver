"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  countAllComments,
  createComment,
  fetchPostComments,
  toggleCommentLike,
} from "@/lib/comments";
import { formatTimeAgo } from "@/lib/feed";
import { profilePath } from "@/lib/publicProfile";
import type { FeedComment } from "@/types/feed";
import { MentionTextarea } from "./MentionTextarea";
import { PostBody } from "./PostBody";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Props = {
  postId: string;
  currentUserId: string;
  onCommentAdded: () => void;
  highlightCommentId?: string | null;
  defaultOpen?: boolean;
};

export function CommentsPanel({
  postId,
  currentUserId,
  onCommentAdded,
  highlightCommentId,
  defaultOpen = false,
}: Props) {
  const supabase = createClient();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const { isSubmitting: sending, guard } = useSingleSubmit();
  const [expanded, setExpanded] = useState(defaultOpen || !!highlightCommentId);
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalCount = countAllComments(comments);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const tree = await fetchPostComments(supabase, postId, currentUserId);
    setComments(tree);
    setLoading(false);
  }, [postId, supabase, currentUserId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (highlightCommentId) {
      setExpanded(true);
      const el = document.getElementById(`comment-${highlightCommentId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightCommentId, comments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    if (sending) return;
    setSubmitError(null);

    await guard(async () => {
      const { error } = await createComment(supabase, {
        postId,
        authorId: currentUserId,
        body: trimmed,
        parentId: replyTo?.id ?? null,
      });

      if (error) {
        setSubmitError(
          error.message ||
            "Não foi possível enviar. Confirme se a migration 012_comment_replies_likes_mentions.sql foi aplicada no Supabase."
        );
        return;
      }

      setBody("");
      setReplyTo(null);
      await loadComments();
      onCommentAdded();
    });
  }

  function cancelReply() {
    setReplyTo(null);
    setBody("");
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-3 text-xs font-semibold text-[var(--toq-sky)] hover:underline"
      >
        Ver comentários{totalCount > 0 ? ` (${totalCount})` : ""}
      </button>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {loading ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Seja o primeiro a comentar.</p>
      ) : (
        <ul className="mb-3 space-y-3">
          {comments.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              depth={0}
              highlightCommentId={highlightCommentId}
              onReply={(target) => {
                setReplyTo(target);
                setBody(`@${target.author.username} `);
              }}
              onLikeToggle={async (commentId, liked) => {
                await toggleCommentLike(supabase, commentId, currentUserId, liked);
                await loadComments();
              }}
            />
          ))}
        </ul>
      )}

      {replyTo && (
        <p className="mb-2 text-xs text-[var(--toq-text-muted)]">
          Respondendo{" "}
          <span className="font-semibold text-[var(--toq-navy)]">@{replyTo.author.username}</span>
          <button
            type="button"
            onClick={cancelReply}
            className="ml-2 font-semibold text-[var(--toq-sky)] hover:underline"
          >
            Cancelar
          </button>
        </p>
      )}

      <form onSubmit={handleSubmit} className="relative space-y-2">
        <MentionTextarea
          value={body}
          onChange={setBody}
          submitOnEnter
          placeholder={
            replyTo ? `Responder @${replyTo.author.username}…` : "Escreva um comentário… Use @ para mencionar"
          }
          rows={replyTo ? 2 : 2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--toq-accent)]"
        />
        {submitError && (
          <p className="text-xs text-red-600" role="alert">
            {submitError}
          </p>
        )}
        <div className="relative z-20 flex justify-end gap-2 pt-1">
          {replyTo && (
            <button
              type="button"
              onClick={cancelReply}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-[var(--toq-text-muted)]"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-full toq-btn-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {sending ? "Enviando…" : replyTo ? "Responder" : "Comentar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CommentThread({
  comment,
  depth,
  highlightCommentId,
  onReply,
  onLikeToggle,
}: {
  comment: FeedComment;
  depth: number;
  highlightCommentId?: string | null;
  onReply: (c: FeedComment) => void;
  onLikeToggle: (commentId: string, liked: boolean) => Promise<void>;
}) {
  const [liked, setLiked] = useState(comment.liked_by_me);
  const [likesCount, setLikesCount] = useState(comment.likes_count);
  const [likeLoading, setLikeLoading] = useState(false);

  async function handleLike() {
    setLikeLoading(true);
    const next = !liked;
    setLiked(next);
    setLikesCount((c) => c + (next ? 1 : -1));
    try {
      await onLikeToggle(comment.id, next);
    } catch {
      setLiked(!next);
      setLikesCount((c) => c + (next ? -1 : 1));
    }
    setLikeLoading(false);
  }

  const highlighted = highlightCommentId === comment.id;

  return (
    <li
      id={`comment-${comment.id}`}
      className={depth > 0 ? "ml-6 border-l-2 border-slate-100 pl-3" : undefined}
    >
      <div
        className={`flex gap-2 text-sm rounded-lg transition ${
          highlighted ? "toq-btn-primary bg-[var(--toq-accent)]/25 ring-2 ring-[var(--toq-accent-soft)]" : ""
        }`}
      >
        <CommentAvatar src={comment.author.avatar_url} name={comment.author.username} />
        <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs font-bold text-[var(--toq-navy)]">
            <Link
              href={profilePath(comment.author.username)}
              className="hover:text-[var(--toq-sky)]"
            >
              {comment.author.username}
            </Link>{" "}
            <span className="font-normal text-[var(--toq-text-muted)]">
              · {formatTimeAgo(comment.created_at)}
            </span>
          </p>
          <div className="mt-0.5 text-sm">
            <PostBody body={comment.body} />
          </div>
          {comment.mentions.length > 0 && (
            <p className="mt-1 text-[10px] text-[var(--toq-text-muted)]">
              Mencionados:{" "}
              {comment.mentions.map((m, i) => (
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
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
            <button
              type="button"
              disabled={likeLoading}
              onClick={handleLike}
              className={`font-semibold disabled:opacity-50 ${
                liked ? "text-red-500" : "text-[var(--toq-text-muted)] hover:text-red-500"
              }`}
            >
              {liked ? "♥" : "♡"} {likesCount > 0 ? likesCount : ""} Curtir
            </button>
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="font-semibold text-[var(--toq-sky)] hover:underline"
            >
              Responder
            </button>
          </div>
        </div>
      </div>

      {comment.replies.length > 0 && (
        <ul className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              highlightCommentId={highlightCommentId}
              onReply={onReply}
              onLikeToggle={onLikeToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CommentAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--toq-sky)] text-[10px] font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
