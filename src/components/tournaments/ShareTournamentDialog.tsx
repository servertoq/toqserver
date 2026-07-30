"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import {
  fetchConversations,
  getOrCreateCommunityConversation,
  getOrCreateConversation,
  searchProfilesForMessages,
  sendMessage,
  type MessageSearchProfile,
} from "@/lib/messages";
import { tournamentShareMessage } from "@/lib/tournaments";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { ClubTournament } from "@/types/clubFeatures";
import type { DmCommunityConversation, DmDirectConversation } from "@/types/messages";

type Props = {
  tournament: ClubTournament;
  open: boolean;
  onClose: () => void;
};

type ShareTab = "friends" | "groups";

export function ShareTournamentDialog({ tournament, open, onClose }: Props) {
  const supabase = createClient();
  const profile = useAppProfile();
  const { isSubmitting, guard } = useSingleSubmit();
  const [tab, setTab] = useState<ShareTab>("friends");
  const [friends, setFriends] = useState<DmDirectConversation[]>([]);
  const [groups, setGroups] = useState<DmCommunityConversation[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageSearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    const list = await fetchConversations(supabase, profile.id);
    setFriends(
      list.filter((c): c is DmDirectConversation => c.kind === "direct" && c.is_friend)
    );
    setGroups(list.filter((c): c is DmCommunityConversation => c.kind === "community"));
    setLoading(false);
  }, [profile.id, supabase]);

  useEffect(() => {
    if (!open) return;
    setTab("friends");
    setQuery("");
    setResults([]);
    setStatus(null);
    setError(null);
    void loadTargets();
  }, [open, loadTargets]);

  useEffect(() => {
    if (!open || tab !== "friends") return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void searchProfilesForMessages(supabase, q, profile.id).then(setResults);
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, profile.id, query, supabase, tab]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.community.name.toLowerCase().includes(q) ||
        g.community.slug.toLowerCase().includes(q)
    );
  }, [groups, query]);

  async function shareWithUser(userId: string, label: string) {
    setError(null);
    setStatus(null);
    await guard(async () => {
      const { id: convId, error: createErr } = await getOrCreateConversation(supabase, userId);
      if (!convId) {
        setError(createErr ?? "Não foi possível abrir a conversa.");
        return;
      }
      const { error: sendErr } = await sendMessage(
        supabase,
        convId,
        profile.id,
        tournamentShareMessage(tournament)
      );
      if (sendErr) {
        setError(sendErr);
        return;
      }
      setStatus(`Torneio enviado para ${label}.`);
    });
  }

  async function shareWithGroup(group: DmCommunityConversation) {
    setError(null);
    setStatus(null);
    await guard(async () => {
      let convId = group.id;
      const { id: ensuredId, error: createErr } = await getOrCreateCommunityConversation(
        supabase,
        group.community.id
      );
      if (ensuredId) convId = ensuredId;
      else if (createErr) {
        setError(createErr);
        return;
      }

      const { error: sendErr } = await sendMessage(
        supabase,
        convId,
        profile.id,
        tournamentShareMessage(tournament)
      );
      if (sendErr) {
        setError(sendErr);
        return;
      }

      const kindLabel = group.community.group_kind === "club" ? "clube" : "comunidade";
      setStatus(`Torneio enviado para ${kindLabel} ${group.community.name}.`);
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-tournament-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 id="share-tournament-title" className="text-sm font-bold text-[var(--toq-navy)]">
              Compartilhar no chat
            </h2>
            <p className="mt-0.5 text-xs text-[var(--toq-text-muted)] line-clamp-1">
              {tournament.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--toq-text-muted)] hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setTab("friends");
                setQuery("");
                setResults([]);
                setStatus(null);
                setError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === "friends"
                  ? "bg-white text-[var(--toq-navy)] shadow-sm"
                  : "text-[var(--toq-text-muted)]"
              }`}
            >
              Amigos
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("groups");
                setQuery("");
                setResults([]);
                setStatus(null);
                setError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === "groups"
                  ? "bg-white text-[var(--toq-navy)] shadow-sm"
                  : "text-[var(--toq-text-muted)]"
              }`}
            >
              Grupos
            </button>
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "friends" ? "Buscar usuário pelo @…" : "Buscar comunidade ou clube…"
            }
            className="toq-input w-full px-3 py-2 text-sm"
            autoFocus
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
          {status && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{status}</p>
          )}

          {tab === "friends" ? (
            query.trim().length >= 2 ? (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {results.length === 0 ? (
                  <li className="px-1 py-3 text-center text-xs text-[var(--toq-text-muted)]">
                    Nenhum usuário encontrado
                  </li>
                ) : (
                  results.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void shareWithUser(user.id, `@${user.username}`)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
                      >
                        <ProfileAvatar src={user.avatar_url} name={user.username} size="sm" />
                        <span className="text-sm font-semibold text-[var(--toq-navy)]">
                          @{user.username}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
                  Amigos recentes
                </p>
                {loading ? (
                  <p className="text-xs text-[var(--toq-text-muted)]">Carregando…</p>
                ) : friends.length === 0 ? (
                  <p className="text-xs text-[var(--toq-text-muted)]">
                    Busque um @ acima para enviar o torneio.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {friends.map((conv) => (
                      <li key={conv.id}>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() =>
                            void shareWithUser(conv.other_user.id, `@${conv.other_user.username}`)
                          }
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
                        >
                          <ProfileAvatar
                            src={conv.other_user.avatar_url}
                            name={conv.other_user.username}
                            size="sm"
                          />
                          <span className="text-sm font-semibold text-[var(--toq-navy)]">
                            @{conv.other_user.username}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          ) : loading ? (
            <p className="text-xs text-[var(--toq-text-muted)]">Carregando…</p>
          ) : filteredGroups.length === 0 ? (
            <p className="text-xs text-[var(--toq-text-muted)]">
              {groups.length === 0
                ? "Você ainda não tem chats de comunidade ou clube."
                : "Nenhum grupo encontrado com essa busca."}
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {filteredGroups.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void shareWithGroup(group)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
                  >
                    <ProfileAvatar
                      src={group.community.cover_image_url}
                      name={group.community.name}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--toq-navy)] line-clamp-1">
                        {group.community.name}
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--toq-text-muted)]">
                        {group.community.group_kind === "club" ? "Clube" : "Comunidade"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
