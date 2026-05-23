"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { memberRoleLabel, sortMembers } from "@/lib/community";
import type { CommunityGroupKind, CommunityInvite, CommunityJoinRequest, CommunityMember, CommunityMemberRole } from "@/types/community";

type Props = {
  communityId: string;
  groupKind: CommunityGroupKind;
  myRole: CommunityMemberRole;
  onChanged: () => void;
};

export function CommunityModerationPanel({ communityId, groupKind, myRole, onChanged }: Props) {
  const supabase = createClient();
  const isOwner = myRole === "owner";
  const groupLabel = groupKind === "club" ? "clube" : "comunidade";
  const [tab, setTab] = useState<"requests" | "members" | "invite">("requests");
  const [requests, setRequests] = useState<CommunityJoinRequest[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<CommunityInvite[]>([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: reqRows } = await supabase
      .from("community_join_requests")
      .select(
        `
        id,
        community_id,
        user_id,
        status,
        created_at,
        user:profiles!community_join_requests_user_id_fkey(id, username, avatar_url)
      `
      )
      .eq("community_id", communityId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const mappedReqs: CommunityJoinRequest[] = (reqRows ?? []).map((r) => {
      const u = Array.isArray(r.user) ? r.user[0] : r.user;
      return {
        id: r.id,
        community_id: r.community_id,
        user_id: r.user_id,
        status: r.status,
        created_at: r.created_at,
        user: u ?? undefined,
      };
    });
    setRequests(mappedReqs);

    const { data: invRows } = await supabase
      .from("community_invites")
      .select(
        `
        id,
        community_id,
        inviter_id,
        invitee_id,
        status,
        created_at,
        invitee:profiles!community_invites_invitee_id_fkey(id, username, avatar_url)
      `
      )
      .eq("community_id", communityId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const mappedInvites: CommunityInvite[] = (invRows ?? []).map((r) => {
      const u = Array.isArray(r.invitee) ? r.invitee[0] : r.invitee;
      return {
        id: r.id,
        community_id: r.community_id,
        inviter_id: r.inviter_id,
        invitee_id: r.invitee_id,
        status: r.status,
        created_at: r.created_at,
        invitee: u ?? undefined,
      };
    });
    setPendingInvites(mappedInvites);

    const { data: memRows } = await supabase
      .from("community_members")
      .select(
        `
        user_id,
        role,
        joined_at,
        profile:profiles!community_members_user_id_fkey(id, username, avatar_url)
      `
      )
      .eq("community_id", communityId);

    const mappedMembers: CommunityMember[] = (memRows ?? []).map((m) => {
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      return {
        user_id: m.user_id,
        role: m.role as CommunityMemberRole,
        joined_at: m.joined_at,
        profile: p ?? { id: m.user_id, username: "?", avatar_url: null },
      };
    });
    setMembers(sortMembers(mappedMembers));
    setLoading(false);
  }, [communityId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function respondRequest(requestId: string, approve: boolean) {
    setActionId(requestId);
    await supabase.rpc("respond_community_join_request", {
      p_request_id: requestId,
      p_approve: approve,
    });
    setActionId(null);
    await load();
    onChanged();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inviteUsername.trim().replace(/^@/, "");
    if (trimmed.length < 3) {
      setInviteMessage("Informe um nome de usuário válido.");
      return;
    }

    setActionId("invite");
    setInviteMessage(null);
    const { error } = await supabase.rpc("invite_community_member_by_username", {
      p_community_id: communityId,
      p_username: trimmed,
    });

    if (error) {
      setInviteMessage(error.message);
    } else {
      setInviteUsername("");
      setInviteMessage(`Convite enviado para @${trimmed}. O jogador precisa aceitar para entrar.`);
      await load();
      onChanged();
    }
    setActionId(null);
  }

  async function kickMember(userId: string) {
    if (!confirm(`Remover este membro do ${groupLabel}?`)) return;
    setActionId(userId);
    await supabase.rpc("remove_community_member", {
      p_community_id: communityId,
      p_user_id: userId,
    });
    setActionId(null);
    await load();
    onChanged();
  }

  async function toggleModerator(userId: string, makeMod: boolean) {
    setActionId(userId);
    await supabase.rpc("set_community_moderator", {
      p_community_id: communityId,
      p_user_id: userId,
      p_is_moderator: makeMod,
    });
    setActionId(null);
    await load();
    onChanged();
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-[var(--toq-navy)]">Moderação</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            tab === "requests"
              ? "bg-[var(--toq-lime-light)] text-[var(--toq-navy)]"
              : "bg-slate-100 text-[var(--toq-text-muted)]"
          }`}
        >
          Pedidos ({requests.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("invite")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            tab === "invite"
              ? "bg-[var(--toq-lime-light)] text-[var(--toq-navy)]"
              : "bg-slate-100 text-[var(--toq-text-muted)]"
          }`}
        >
          Convidar
        </button>
        <button
          type="button"
          onClick={() => setTab("members")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            tab === "members"
              ? "bg-[var(--toq-lime-light)] text-[var(--toq-navy)]"
              : "bg-slate-100 text-[var(--toq-text-muted)]"
          }`}
        >
          Membros
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-xs text-[var(--toq-text-muted)]">Carregando…</p>
      ) : tab === "invite" ? (
        <div className="mt-4 space-y-4">
          <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Convidar jogador</span>
              <input
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="@usuario"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)]"
              />
            </label>
            <button
              type="submit"
              disabled={actionId === "invite"}
              className="rounded-lg bg-[var(--toq-lime-light)] px-4 py-2 text-xs font-bold text-[var(--toq-navy)] disabled:opacity-50"
            >
              {actionId === "invite" ? "Enviando…" : "Enviar convite"}
            </button>
          </form>
          <p className="text-[11px] text-[var(--toq-text-muted)]">
            O jogador receberá uma notificação e só entrará no {groupLabel} após aceitar o convite.
          </p>
          {inviteMessage && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-[var(--toq-navy)]">{inviteMessage}</p>
          )}
          {pendingInvites.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--toq-text-muted)]">Convites pendentes</p>
              <ul className="space-y-2">
                {pendingInvites.map((inv) => (
                  <li key={inv.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-[var(--toq-navy)]">
                    @{inv.invitee?.username ?? "usuário"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : tab === "requests" ? (
        <ul className="mt-4 space-y-3">
          {requests.length === 0 ? (
            <li className="text-xs text-[var(--toq-text-muted)]">Nenhum pedido pendente.</li>
          ) : (
            requests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="text-sm font-semibold text-[var(--toq-navy)]">
                  @{req.user?.username ?? "usuário"}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actionId === req.id}
                    onClick={() => respondRequest(req.id, true)}
                    className="rounded-lg bg-[var(--toq-lime-light)] px-3 py-1 text-xs font-bold text-[var(--toq-navy)] disabled:opacity-50"
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    disabled={actionId === req.id}
                    onClick={() => respondRequest(req.id, false)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-[var(--toq-text-muted)] disabled:opacity-50"
                  >
                    Recusar
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : (
        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
            >
              <div>
                <span className="text-sm font-semibold text-[var(--toq-navy)]">
                  @{m.profile.username}
                </span>
                <span className="ml-2 text-[10px] font-bold uppercase text-[var(--toq-text-muted)]">
                  {memberRoleLabel(m.role)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {isOwner && m.role === "member" && (
                  <button
                    type="button"
                    disabled={actionId === m.user_id}
                    onClick={() => toggleModerator(m.user_id, true)}
                    className="text-xs font-semibold text-[var(--toq-sky)]"
                  >
                    Tornar moderador
                  </button>
                )}
                {isOwner && m.role === "moderator" && (
                  <button
                    type="button"
                    disabled={actionId === m.user_id}
                    onClick={() => toggleModerator(m.user_id, false)}
                    className="text-xs font-semibold text-[var(--toq-text-muted)]"
                  >
                    Remover mod.
                  </button>
                )}
                {m.role !== "owner" && (
                  <button
                    type="button"
                    disabled={actionId === m.user_id}
                    onClick={() => kickMember(m.user_id)}
                    className="text-xs font-semibold text-red-600"
                  >
                    Expulsar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
