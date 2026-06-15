"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { formatFriendRequestError } from "@/lib/friendRequest";

type FriendRow = {
  friend_id: string;
  profile: { username: string; avatar_url: string | null };
};

export function FriendsPanel({ userId, embedded }: { userId: string; embedded?: boolean }) {
  const supabase = createClient();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const { isSubmitting: adding, guard } = useSingleSubmit();
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("friendships")
      .select(
        `
        friend_id,
        profile:profiles!friendships_friend_id_fkey(username, avatar_url)
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const rows: FriendRow[] = (data ?? []).map((r) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return {
        friend_id: r.friend_id,
        profile: p ?? { username: "?", avatar_url: null },
      };
    });
    setFriends(rows);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim().replace(/^@/, "");
    if (trimmed.length < 3) {
      setMessage("Informe um nome de usuário válido.");
      return;
    }

    if (adding) return;
    setMessage(null);

    await guard(async () => {
      const { data: profiles, error: findErr } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", trimmed)
        .limit(2);

      const profile = profiles?.length === 1 ? profiles[0] : null;

      if (findErr || !profile) {
        setMessage("Usuário não encontrado.");
        return;
      }

      if (profile.id === userId) {
        setMessage("Você não pode adicionar a si mesmo.");
        return;
      }

      const { error: requestErr } = await supabase.rpc("send_friend_request", {
        p_addressee_id: profile.id,
      });

      if (requestErr) {
        setMessage(formatFriendRequestError(requestErr.message));
        return;
      }

      setUsername("");
      setMessage(`Pedido de amizade enviado para @${profile.username}.`);
      await load();
    });
  }

  async function handleRemove(friendId: string) {
    await supabase.rpc("remove_friendship", { p_other_user_id: friendId });
    await load();
  }

  const wrapperClass = embedded
    ? "space-y-4"
    : "mt-6 toq-card p-5 shadow-sm";

  return (
    <section className={wrapperClass}>
      <h2 className={`font-bold text-[var(--toq-navy)] ${embedded ? "profile-section-label" : "text-sm"}`}>
        {embedded ? "Rede de amigos" : "Amigos"}
      </h2>
      <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
        Envie pedidos de amizade. Quando aceitos, você verá os posts <strong>privados</strong> deles no feed.
      </p>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@nome_de_usuario"
          className="min-w-[180px] flex-1 rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-[var(--toq-profile-accent,#2563eb)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {adding ? "…" : "Adicionar"}
        </button>
      </form>

      {message && (
        <p className="mt-2 text-xs text-[var(--toq-text-muted)]" role="status">
          {message}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-xs text-[var(--toq-text-muted)]">Carregando…</li>
        ) : friends.length === 0 ? (
          <li className="text-xs text-[var(--toq-text-muted)]">Nenhum amigo adicionado ainda.</li>
        ) : (
          friends.map((f) => (
            <li
              key={f.friend_id}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
            >
              <span className="text-sm font-semibold text-[var(--toq-navy)]">
                @{f.profile.username}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(f.friend_id)}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                Remover
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
