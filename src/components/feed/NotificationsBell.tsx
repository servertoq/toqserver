"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  actor:profiles!notifications_actor_id_fkey(id, username, avatar_url),
  community:communities(id, name, slug)
`;

export function NotificationsBell() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const unreadCount = items.filter((n) => !n.read_at).length;

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
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
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

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) {
            setLoading(true);
            load().finally(() => setLoading(false));
          }
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[var(--toq-navy)] transition hover:bg-slate-50"
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

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-[var(--toq-navy)]">Notificações</h2>
          </div>
          <ul className="max-h-[min(420px,60vh)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-[var(--toq-text-muted)]">
                Carregando…
              </li>
            ) : items.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-[var(--toq-text-muted)]">
                Nenhuma notificação ainda.
              </li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-slate-50 ${
                    !n.read_at ? "bg-[var(--toq-lime-light)]/10" : ""
                  }`}
                >
                  {notificationHref(n) ? (
                    <button
                      type="button"
                      onClick={() => handleOpen(n)}
                      className="flex w-full gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      <NotifAvatar src={n.actor.avatar_url} name={n.actor.username} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug text-[var(--toq-navy)]">
                          {notificationMessage(n)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[var(--toq-text-muted)]">
                          {formatTimeAgo(n.created_at)}
                        </p>
                        {n.type === "friend_request" && (
                          <p className="mt-1 text-[10px] font-semibold text-[var(--toq-sky)]">
                            Ver perfil
                          </p>
                        )}
                        {(n.type === "post_comment" ||
                          n.type === "comment_reply" ||
                          n.type === "comment_like" ||
                          n.type === "comment_mention") && (
                          <p className="mt-1 text-[10px] font-semibold text-[var(--toq-sky)]">
                            Ver comentário
                          </p>
                        )}
                      </div>
                    </button>
                  ) : (
                    <div className="flex gap-2 px-4 py-3">
                      <NotifAvatar src={n.actor.avatar_url} name={n.actor.username} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug text-[var(--toq-navy)]">
                          {notificationMessage(n)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[var(--toq-text-muted)]">
                          {formatTimeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="px-4 pb-3">
                      {n.type === "friend_request" && n.friend_request_id && !n.read_at && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actingId === n.friend_request_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              respondFriend(n.friend_request_id!, true);
                            }}
                            className="rounded-lg bg-[var(--toq-lime-light)] px-2.5 py-1 text-[10px] font-bold text-[var(--toq-navy)] disabled:opacity-50"
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
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-[var(--toq-text-muted)] disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </div>
                      )}

                      {n.type === "community_join_request" &&
                        n.join_request_id &&
                        !n.read_at && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={actingId === n.join_request_id}
                              onClick={() => respondJoin(n.join_request_id!, true)}
                              className="rounded-lg bg-[var(--toq-lime-light)] px-2.5 py-1 text-[10px] font-bold text-[var(--toq-navy)] disabled:opacity-50"
                            >
                              Aceitar
                            </button>
                            <button
                              type="button"
                              disabled={actingId === n.join_request_id}
                              onClick={() => respondJoin(n.join_request_id!, false)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-[var(--toq-text-muted)] disabled:opacity-50"
                            >
                              Recusar
                            </button>
                          </div>
                        )}

                      {n.type === "community_join" && n.community?.slug && !notificationHref(n) && (
                        <Link
                          href={`/inicio/comunidade/${n.community.slug}`}
                          onClick={() => markRead(n.id)}
                          className="inline-block text-[10px] font-semibold text-[var(--toq-sky)] hover:underline"
                        >
                          Ver comunidade
                        </Link>
                      )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
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

function NotifAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--toq-sky)] text-xs font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
