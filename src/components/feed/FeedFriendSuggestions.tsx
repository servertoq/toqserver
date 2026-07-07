"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { formatFriendRequestError } from "@/lib/friendRequest";
import { fetchFriendSuggestions, type FriendSuggestion } from "@/lib/friendSuggestions";
import { profileDisplayName } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

const RAIL_PAGE_SIZE = 4;
const CAROUSEL_SIZE = 8;

type Props = {
  variant?: "rail" | "carousel";
  className?: string;
};

export function FeedFriendSuggestions({ variant = "rail", className = "" }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const pageSize = variant === "carousel" ? CAROUSEL_SIZE : RAIL_PAGE_SIZE;
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const { isSubmitting: acting, guard } = useSingleSubmit();

  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      const { data, error: loadErr } = await fetchFriendSuggestions(supabase, {
        limit: pageSize,
        offset: nextOffset,
      });
      setLoading(false);
      if (loadErr) {
        setError(loadErr.message);
        setSuggestions([]);
        return;
      }
      if (data.length === 0 && nextOffset > 0) {
        void load(0);
        return;
      }
      setSuggestions(data);
      setOffset(nextOffset);
    },
    [pageSize, supabase]
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  function refresh() {
    void load(offset + pageSize);
  }

  async function sendRequest(targetId: string) {
    await guard(async () => {
      setError(null);
      const { error: rpcErr } = await supabase.rpc("send_friend_request", {
        p_addressee_id: targetId,
      });
      if (rpcErr) {
        setError(formatFriendRequestError(rpcErr.message));
        return;
      }
      setSentIds((prev) => new Set(prev).add(targetId));
    });
  }

  const rootClass =
    variant === "carousel"
      ? `feed-inline-suggestions ${className}`.trim()
      : `feed-friend-suggestions ${className}`.trim();

  return (
    <section className={rootClass}>
      <div className="feed-friend-suggestions-header">
        <h2 className="feed-friend-suggestions-title">Sugestões para você</h2>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="feed-friend-suggestions-refresh"
          aria-label="Atualizar sugestões"
          title="Atualizar sugestões"
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3" />
          </svg>
        </button>
      </div>

      {error && (
        <p className="mb-2 text-[11px] text-red-500" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Carregando sugestões…</p>
      ) : suggestions.length === 0 ? (
        <p className="text-xs leading-relaxed text-[var(--toq-text-muted)]">
          {profile.id
            ? "Nenhuma sugestão no momento. Adicione mais amigos para descobrir pessoas em comum."
            : "Faça login para ver sugestões."}
        </p>
      ) : variant === "carousel" ? (
        <div className="feed-suggestions-carousel-track" role="list">
          {suggestions.map((item) => {
            const name = profileDisplayName(item);
            const sent = sentIds.has(item.profile_id);
            return (
              <article key={item.profile_id} className="feed-suggestions-carousel-card" role="listitem">
                <Link href={profilePath(item.username)} className="feed-suggestions-carousel-profile">
                  <SuggestionAvatar src={item.avatar_url} name={name} size="lg" />
                  <p className="mt-2 truncate text-center text-xs font-semibold text-[var(--toq-navy)]">
                    {name}
                  </p>
                  <p className="mt-0.5 truncate text-center text-[10px] text-[var(--toq-text-muted)]">
                    {item.mutual_count === 1
                      ? "1 amigo em comum"
                      : `${item.mutual_count} amigos em comum`}
                  </p>
                </Link>
                <button
                  type="button"
                  disabled={acting || sent}
                  onClick={() => void sendRequest(item.profile_id)}
                  className="feed-suggestions-carousel-add"
                >
                  {sent ? "Enviado" : "Adicionar"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <ul className="feed-friend-suggestions-list">
          {suggestions.map((item) => {
            const name = profileDisplayName(item);
            const sent = sentIds.has(item.profile_id);
            return (
              <li key={item.profile_id} className="feed-friend-suggestion-item">
                <Link href={profilePath(item.username)} className="feed-friend-suggestion-profile">
                  <SuggestionAvatar src={item.avatar_url} name={name} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--toq-navy)]">{name}</p>
                    <p className="truncate text-[10px] text-[var(--toq-text-muted)]">
                      {item.mutual_count === 1
                        ? "1 amigo em comum"
                        : `${item.mutual_count} amigos em comum`}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  disabled={acting || sent}
                  onClick={() => void sendRequest(item.profile_id)}
                  className="feed-friend-suggestion-add"
                >
                  {sent ? "Enviado" : "Adicionar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SuggestionAvatar({
  src,
  name,
  size = "sm",
}: {
  src: string | null;
  name: string;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "h-14 w-14 text-base" : "h-9 w-9 text-xs";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${dim} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-[var(--toq-sky)] font-bold text-white`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
