"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateConversation } from "@/lib/messages";
import { profileDisplayName } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";
import {
  parseMatchInterestState,
  type MatchInterestState,
} from "@/lib/postMatches";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type Props = {
  postId: string;
  capacityHint?: number | null;
};

export function MatchInterestBlock({ postId, capacityHint = null }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [state, setState] = useState<MatchInterestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const { isSubmitting: toggling, guard } = useSingleSubmit();
  const { isSubmitting: chatting, guard: guardChat } = useSingleSubmit();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadErr } = await supabase.rpc("get_match_interest_state", {
      p_post_id: postId,
    });
    if (loadErr) {
      setError(loadErr.message);
      setState(null);
    } else {
      setState(parseMatchInterestState(data));
      setError(null);
    }
    setLoading(false);
  }, [postId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleInterest() {
    if (toggling) return;
    await guard(async () => {
      setError(null);
      const { data, error: toggleErr } = await supabase.rpc("toggle_match_interest", {
        p_post_id: postId,
      });
      if (toggleErr) {
        setError(toggleErr.message || "Não foi possível atualizar o interesse.");
        return;
      }
      const parsed = parseMatchInterestState(data);
      if (parsed) setState(parsed);
      else await load();
    });
  }

  async function openChat(userId: string) {
    if (chatting) return;
    setChatUserId(userId);
    await guardChat(async () => {
      setError(null);
      try {
        const { id: conversationId, error: chatErr } = await getOrCreateConversation(
          supabase,
          userId
        );
        if (chatErr || !conversationId) {
          setError(chatErr ?? "Não foi possível abrir o chat.");
          return;
        }
        router.push(`/inicio/mensagens?c=${encodeURIComponent(conversationId)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível abrir o chat.");
      } finally {
        setChatUserId(null);
      }
    });
  }

  if (loading) {
    return <p className="mt-2 text-xs text-[var(--toq-text-muted)]">Carregando partida…</p>;
  }

  if (!state) {
    return error ? (
      <p className="mt-2 text-xs text-red-500" role="alert">
        {error}
      </p>
    ) : null;
  }

  const capacity = state.capacity || capacityHint || 0;
  const full = state.interest_count >= capacity;
  const showToggle = !state.is_author;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)]/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--toq-navy)]">
          Interessados{" "}
          <span className="tabular-nums text-[var(--toq-accent)]">
            {state.interest_count}/{capacity}
          </span>
        </p>
        {showToggle && (
          <button
            type="button"
            disabled={toggling || (full && !state.my_interested)}
            onClick={() => void toggleInterest()}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
              state.my_interested
                ? "border border-[var(--toq-border)] text-[var(--toq-navy)] hover:bg-[var(--toq-input-bg)]"
                : "toq-btn-primary text-white"
            }`}
          >
            {toggling
              ? "Salvando…"
              : state.my_interested
                ? "Remover interesse"
                : full
                  ? "Vagas preenchidas"
                  : "Tenho interesse"}
          </button>
        )}
      </div>

      {state.interested.length === 0 ? (
        <p className="text-[11px] text-[var(--toq-text-muted)]">
          Ninguém marcou interesse ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {state.interested.map((user) => {
            const name = profileDisplayName({
              display_name: user.display_name,
              username: user.username,
            });
            return (
              <li
                key={user.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--toq-border)] bg-[var(--toq-input-bg)] px-2.5 py-2"
              >
                <Link
                  href={profilePath(user.username)}
                  className="flex min-w-0 items-center gap-2"
                >
                  <ProfileAvatar src={user.avatar_url} name={name} size="sm" />
                  <span className="truncate text-xs font-semibold text-[var(--toq-navy)]">
                    {name}
                  </span>
                </Link>
                {state.is_author && (
                  <button
                    type="button"
                    disabled={chatting && chatUserId === user.id}
                    onClick={() => void openChat(user.id)}
                    className="shrink-0 rounded-lg toq-btn-outline px-2.5 py-1 text-[10px] font-bold"
                  >
                    {chatting && chatUserId === user.id ? "Abrindo…" : "Chamar no chat"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
