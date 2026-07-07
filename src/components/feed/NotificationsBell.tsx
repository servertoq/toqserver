"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { formatTimeAgo } from "@/lib/feed";
import {
  mapNotificationRow,
  notificationHref,
  notificationMessage,
} from "@/lib/notifications";
import type { AppNotification } from "@/types/notifications";

const NOTIFICATION_SELECT = `
  id,
  type,
  created_at,
  read_at,
  post_id,
  comment_id,
  community_id,
  friend_request_id,
  join_request_id,
  community_invite_id,
  support_ticket_id,
  actor:profiles!notifications_actor_id_fkey(id, username, avatar_url),
  community:communities(id, name, slug, kind)
`;

export function NotificationsBell({ compact = false }: { compact?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 380 });
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const updateDropdownPos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 32);
    let left = rect.right - width;
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));

    setDropdownPos({
      top: rect.bottom + 8,
      left,
      width,
    });
  }, []);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);

    setItems((data ?? []).map((r) => mapNotificationRow(r)));
  }, [supabase]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      await load();

      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => {
            load();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => {
            load();
          }
        )
        .subscribe();

      if (cancelled) {
        supabase.removeChannel(channel);
        return;
      }
      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [load, supabase]);

  useEffect(() => {
    if (!open) return;

    updateDropdownPos();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    window.addEventListener("resize", updateDropdownPos);
    window.addEventListener("scroll", updateDropdownPos, true);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      window.removeEventListener("resize", updateDropdownPos);
      window.removeEventListener("scroll", updateDropdownPos, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, updateDropdownPos]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function markRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }

  async function handleOpen(n: AppNotification) {
    if (!n.read_at) await markRead(n.id);
    const href = notificationHref(n);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  async function respondFriend(requestId: string, accept: boolean) {
    setActingId(requestId);
    await supabase.rpc("respond_friend_request", {
      p_request_id: requestId,
      p_accept: accept,
    });
    await load();
    setActingId(null);
  }

  async function respondJoin(requestId: string, accept: boolean) {
    setActingId(requestId);
    await supabase.rpc("respond_community_join_request", {
      p_request_id: requestId,
      p_approve: accept,
    });
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("join_request_id", requestId);
    await load();
    setActingId(null);
  }

  async function respondInvite(inviteId: string, accept: boolean) {
    setActingId(inviteId);
    await supabase.rpc("respond_community_invite", {
      p_invite_id: inviteId,
      p_accept: accept,
    });
    await load();
    setActingId(null);
  }

  const dropdown =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        style={{
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
        }}
        className="notifications-dropdown fixed z-[130] overflow-hidden rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-[0_16px_48px_rgba(5,16,36,0.2)]"
        role="dialog"
        aria-label="Notificações"
      >
        <div className="flex items-center justify-between border-b border-[var(--toq-border)] px-4 py-3.5">
          <h2 className="text-sm font-bold text-[var(--toq-navy)]">Notificações</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--toq-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--toq-accent)]">
              {unreadCount} {unreadCount === 1 ? "nova" : "novas"}
            </span>
          )}
        </div>
        <ul className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain">
          {loading && items.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-[var(--toq-text-muted)]">
              Carregando…
            </li>
          ) : items.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-[var(--toq-text-muted)]">
              Nenhuma notificação ainda.
            </li>
          ) : (
            items.map((n) => {
              const href = notificationHref(n);
              const unread = !n.read_at;
              const showFriendActions =
                n.type === "friend_request" && n.friend_request_id && unread;
              const showJoinActions =
                n.type === "community_join_request" && n.join_request_id && unread;
              const showInviteActions =
                n.type === "community_invite" && n.community_invite_id && unread;
              const showCommunityLink =
                n.type === "community_join" && n.community?.slug && href;
              const hasActions =
                showFriendActions || showJoinActions || showInviteActions || showCommunityLink;

              const content = (
                <>
                  <NotifAvatar src={n.actor.avatar_url} name={n.actor.username} unread={unread} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-[var(--toq-navy)]">
                      {notificationMessage(n)}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
                      {formatTimeAgo(n.created_at)}
                    </p>
                    {href &&
                      (n.type === "friend_request" ||
                        n.type === "post_comment" ||
                        n.type === "comment_reply" ||
                        n.type === "comment_like" ||
                        n.type === "comment_mention") && (
                        <p className="mt-1.5 text-[11px] font-semibold text-[var(--toq-accent)]">
                          {n.type === "friend_request" ? "Ver perfil" : "Ver comentário"}
                        </p>
                      )}
                  </div>
                  {unread && (
                    <span
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--toq-accent)]"
                      aria-hidden
                    />
                  )}
                </>
              );

              return (
                <li
                  key={n.id}
                  className={`border-b border-[var(--toq-border)] last:border-b-0 ${
                    unread ? "bg-[var(--toq-accent-soft)]" : "bg-[var(--toq-card)]"
                  }`}
                >
                  {href ? (
                    <button
                      type="button"
                      onClick={() => handleOpen(n)}
                      className={`flex w-full gap-3 px-4 py-3.5 text-left transition ${
                        unread ? "hover:bg-[var(--toq-accent-soft)]" : "hover:bg-[var(--toq-surface)]"
                      }`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex gap-3 px-4 py-3.5">{content}</div>
                  )}

                  {hasActions && (
                    <div className="flex flex-wrap gap-2 px-4 pb-3.5 pl-[3.75rem]">
                      {showFriendActions && (
                        <>
                          <button
                            type="button"
                            disabled={actingId === n.friend_request_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              respondFriend(n.friend_request_id!, true);
                            }}
                            className="rounded-lg toq-btn-primary px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                          >
                            Aceitar
                          </button>
                          <button
                            type="button"
                            disabled={actingId === n.friend_request_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              respondFriend(n.friend_request_id!, false);
                            }}
                            className="rounded-lg toq-btn-outline px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </>
                      )}

                      {showJoinActions && (
                        <>
                          <button
                            type="button"
                            disabled={actingId === n.join_request_id}
                            onClick={() => respondJoin(n.join_request_id!, true)}
                            className="rounded-lg toq-btn-primary px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                          >
                            Aceitar
                          </button>
                          <button
                            type="button"
                            disabled={actingId === n.join_request_id}
                            onClick={() => respondJoin(n.join_request_id!, false)}
                            className="rounded-lg toq-btn-outline px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </>
                      )}

                      {showInviteActions && (
                        <>
                          <button
                            type="button"
                            disabled={actingId === n.community_invite_id}
                            onClick={() => respondInvite(n.community_invite_id!, true)}
                            className="rounded-lg toq-btn-primary px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                          >
                            Aceitar
                          </button>
                          <button
                            type="button"
                            disabled={actingId === n.community_invite_id}
                            onClick={() => respondInvite(n.community_invite_id!, false)}
                            className="rounded-lg toq-btn-outline px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </>
                      )}

                      {showCommunityLink && (
                        <Link
                          href={href!}
                          onClick={() => markRead(n.id)}
                          className="text-[11px] font-semibold text-[var(--toq-accent)] hover:underline"
                        >
                          {n.community!.kind === "club" ? "Ver clube" : "Ver comunidade"}
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>,
      document.body
    );

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              setLoading(true);
              load().finally(() => setLoading(false));
              requestAnimationFrame(updateDropdownPos);
            }
            return next;
          });
        }}
        className={`relative flex shrink-0 items-center justify-center rounded-full border border-[var(--toq-border)] bg-[var(--toq-card)] text-[var(--toq-navy)] transition hover:bg-[var(--toq-accent-soft)] ${
          compact ? "h-9 w-9" : "h-10 w-10"
        }`}
        aria-label="Notificações"
        aria-expanded={open}
      >
        <IconBell />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {dropdown}
    </div>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-6-6 6 6 0 00-6 6v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function NotifAvatar({
  src,
  name,
  unread = false,
}: {
  src: string | null;
  name: string;
  unread?: boolean;
}) {
  const ring = unread ? "ring-2 ring-[var(--toq-accent)]/30" : "ring-1 ring-slate-200";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`h-9 w-9 shrink-0 rounded-full object-cover ${ring}`}
      />
    );
  }
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-[var(--toq-navy)] ${ring}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
