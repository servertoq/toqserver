"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatTimeAgo } from "@/lib/feed";
import type { FeedComment } from "@/types/feed";

type Props = {
  postId: string;
  currentUserId: string;
  onCommentAdded: () => void;
};

export function CommentsPanel({ postId, currentUserId, onCommentAdded }: Props) {
  const supabase = createClient();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("post_comments")
      .select(
        `
        id,
        body,
        created_at,
        author:profiles!post_comments_author_id_fkey(id, username, avatar_url)
      `
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setComments(
        data.map((row) => {
          const author = Array.isArray(row.author) ? row.author[0] : row.author;
          return {
            id: row.id,
            body: row.body,
            created_at: row.created_at,
            author: author ?? { id: "", username: "?", avatar_url: null },
          };
        })
      );
    }
    setLoading(false);
  }, [postId, supabase]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setSending(true);
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      author_id: currentUserId,
      body: trimmed,
    });

    if (!error) {
      setBody("");
      await loadComments();
      onCommentAdded();
    }
    setSending(false);
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {loading ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Seja o primeiro a comentar.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm">
              <CommentAvatar src={c.author.avatar_url} name={c.author.username} />
              <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold text-[var(--toq-navy)]">
                  {c.author.username}{" "}
                  <span className="font-normal text-[var(--toq-text-muted)]">
                    · {formatTimeAgo(c.created_at)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[var(--toq-text)]">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário…"
          className="min-w-0 flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--toq-lime-light)]"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="shrink-0 rounded-full bg-[var(--toq-lime-light)] px-4 py-2 text-xs font-bold text-[var(--toq-navy)] disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
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
