"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { formatFriendRequestError } from "@/lib/friendRequest";
import { ReportButton } from "@/components/report/ReportButton";
import type { ReportTarget } from "@/types/support";

export type FriendRelation =
  | { status: "none" }
  | { status: "friends" }
  | { status: "pending_sent" }
  | { status: "pending_received"; requestId: string };

type Props = {
  viewerId: string;
  profileId: string;
  profileUsername: string;
  reportTarget?: ReportTarget;
};

const actionPrimary =
  "flex w-full items-center justify-center rounded-xl bg-[var(--toq-profile-accent)] px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50";

const actionSecondary =
  "flex w-full items-center justify-center rounded-xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] px-4 py-2.5 text-xs font-bold text-[var(--toq-profile-navy)] transition hover:border-[var(--toq-profile-accent)] hover:bg-[var(--toq-profile-accent-soft)] disabled:opacity-50";

const actionMuted =
  "flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--toq-profile-muted)] transition hover:bg-[var(--toq-profile-accent-soft)] hover:text-[var(--toq-profile-navy)] disabled:opacity-50";

const actionDanger =
  "flex w-full items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-[var(--toq-profile-muted)] transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50";

export function PublicProfileFriendActions({
  viewerId,
  profileId,
  profileUsername,
  reportTarget,
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
        setMessage(formatFriendRequestError(error.message));
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
    return <span className="text-xs text-[var(--toq-profile-muted)]">Carregando…</span>;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Link
        href={`/inicio/mensagens?chat=${encodeURIComponent(profileUsername)}`}
        className={actionPrimary}
      >
        Conversar
      </Link>

      {relation.status === "none" && (
        <button type="button" disabled={acting} onClick={handleAddFriend} className={actionSecondary}>
          {acting ? "Enviando…" : "Adicionar amigo"}
        </button>
      )}

      {relation.status === "pending_sent" && (
        <span
          className={`${actionSecondary} cursor-default opacity-80`}
          aria-live="polite"
        >
          Pedido enviado
        </span>
      )}

      {relation.status === "pending_received" && (
        <>
          <button
            type="button"
            disabled={acting}
            onClick={() => handleRespond(true)}
            className={actionPrimary}
          >
            Aceitar pedido
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => handleRespond(false)}
            className={actionSecondary}
          >
            Recusar
          </button>
        </>
      )}

      {relation.status === "friends" && (
        <>
          <span
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--toq-profile-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--toq-profile-accent)]"
            aria-label="Vocês são amigos"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
            </svg>
            Amigo
          </span>
          <button
            type="button"
            disabled={acting}
            onClick={handleUnfriend}
            className={actionDanger}
          >
            {acting ? "Removendo…" : "Desfazer amizade"}
          </button>
        </>
      )}

      {reportTarget && (
        <ReportButton
          userId={viewerId}
          target={reportTarget}
          className={actionMuted}
        />
      )}

      {message && (
        <p className="text-center text-[10px] text-[var(--toq-profile-muted)]" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
