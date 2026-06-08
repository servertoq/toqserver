"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

export type FriendRelation =
  | { status: "none" }
  | { status: "friends" }
  | { status: "pending_sent" }
  | { status: "pending_received"; requestId: string };

type Props = {
  viewerId: string;
  profileId: string;
  profileUsername: string;
};

export function PublicProfileFriendActions({
  viewerId,
  profileId,
  profileUsername,
}: Props) {
  const supabase = createClient();
  const [relation, setRelation] = useState<FriendRelation>({ status: "none" });
  const [loading, setLoading] = useState(true);
  const { isSubmitting: acting, guard } = useSingleSubmit();
  const [message, setMessage] = useState<string | null>(null);

  const loadRelation = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id")
      .or(
        `and(user_id.eq.${viewerId},friend_id.eq.${profileId}),and(user_id.eq.${profileId},friend_id.eq.${viewerId})`
      )
      .limit(1);

    if (friendships && friendships.length > 0) {
      setRelation({ status: "friends" });
      setLoading(false);
      return;
    }

    const { data: sent } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("requester_id", viewerId)
      .eq("addressee_id", profileId)
      .eq("status", "pending")
      .maybeSingle();

    if (sent) {
      setRelation({ status: "pending_sent" });
      setLoading(false);
      return;
    }

    const { data: received } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("requester_id", profileId)
      .eq("addressee_id", viewerId)
      .eq("status", "pending")
      .maybeSingle();

    if (received) {
      setRelation({ status: "pending_received", requestId: received.id });
      setLoading(false);
      return;
    }

    setRelation({ status: "none" });
    setLoading(false);
  }, [supabase, viewerId, profileId]);

  useEffect(() => {
    loadRelation();
  }, [loadRelation]);

  async function handleAddFriend() {
    if (acting) return;
    setMessage(null);
    await guard(async () => {
      const { error } = await supabase.rpc("send_friend_request", {
        p_addressee_id: profileId,
      });
      if (error) {
        setMessage(error.message || "Não foi possível enviar o pedido.");
        return;
      }
      setMessage("Pedido de amizade enviado.");
      await loadRelation();
    });
  }

  async function handleRespond(accept: boolean) {
    if (relation.status !== "pending_received" || acting) return;
    setMessage(null);
    await guard(async () => {
      const { error } = await supabase.rpc("respond_friend_request", {
        p_request_id: relation.requestId,
        p_accept: accept,
      });
      if (error) {
        setMessage(error.message || "Não foi possível responder ao pedido.");
        return;
      }
      setMessage(accept ? "Amizade aceita." : "Pedido recusado.");
      await loadRelation();
    });
  }

  async function handleUnfriend() {
    if (acting) return;
    setMessage(null);
    await guard(async () => {
      const { error } = await supabase.rpc("remove_friendship", {
        p_other_user_id: profileId,
      });
      if (error) {
        setMessage(error.message || "Não foi possível desfazer a amizade.");
        return;
      }
      setMessage("Amizade desfeita.");
      await loadRelation();
    });
  }

  if (loading) {
    return (
      <span className="text-xs text-[var(--toq-text-muted)]">…</span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/inicio/mensagens?chat=${encodeURIComponent(profileUsername)}`}
          className="rounded-lg toq-btn-primary px-4 py-2 text-sm font-bold text-white"
        >
          Conversar
        </Link>

        {relation.status === "none" && (
          <button
            type="button"
            disabled={acting}
            onClick={handleAddFriend}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[var(--toq-navy)] disabled:opacity-50"
          >
            {acting ? "Enviando…" : "Adicionar amigo"}
          </button>
        )}

        {relation.status === "pending_sent" && (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-[var(--toq-text-muted)]">
            Pedido enviado
          </span>
        )}

        {relation.status === "pending_received" && (
          <>
            <button
              type="button"
              disabled={acting}
              onClick={() => handleRespond(true)}
              className="rounded-lg toq-btn-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Aceitar pedido
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => handleRespond(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[var(--toq-text-muted)] disabled:opacity-50"
            >
              Recusar
            </button>
          </>
        )}

        {relation.status === "friends" && (
          <>
            <span className="rounded-lg bg-[var(--toq-sky)]/10 px-3 py-1.5 text-xs font-bold text-[var(--toq-sky)]">
              Amigo
            </span>
            <button
              type="button"
              disabled={acting}
              onClick={handleUnfriend}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-red-600 hover:border-red-300 disabled:opacity-50"
            >
              Desfazer amizade
            </button>
          </>
        )}
      </div>

      {message && (
        <p className="text-xs text-[var(--toq-text-muted)]" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
