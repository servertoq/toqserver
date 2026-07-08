"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { profilePath } from "@/lib/publicProfile";
import { profileDisplayName } from "@/lib/profile";
import { isUserOnline } from "@/lib/presence";
import { FeedPageGrid } from "@/components/feed/FeedPageGrid";

const FRIEND_ITEM_WIDTH = 92;
const FRIEND_GAP = 20;
const VISIBLE_FRIENDS = 6;
const CAROUSEL_MAX_WIDTH = FRIEND_ITEM_WIDTH * VISIBLE_FRIENDS + FRIEND_GAP * (VISIBLE_FRIENDS - 1);

type FriendCard = {
  friend_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
};

function ScrollButton({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`online-friends-nav online-friends-nav--${direction}`}
      aria-label={direction === "left" ? "Amigos anteriores" : "Próximos amigos"}
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        {direction === "left" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
        )}
      </svg>
    </button>
  );
}

export function OnlineFriendsStrip({
  edgeToEdge = false,
  embedded = false,
  onOpenCreatePost,
}: {
  edgeToEdge?: boolean;
  embedded?: boolean;
  onOpenCreatePost?: () => void;
}) {
  const supabase = createClient();
  const profile = useAppProfile();
  const [friends, setFriends] = useState<FriendCard[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("friendships")
      .select(
        `
        friend_id,
        profile:profiles!friendships_friend_id_fkey(username, display_name, avatar_url, last_seen_at)
      `
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      setFriends([]);
      return;
    }

    const rows: FriendCard[] = (data ?? []).map((r) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return {
        friend_id: r.friend_id,
        username: p?.username ?? "?",
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        last_seen_at: p?.last_seen_at ?? null,
      };
    });

    setFriends(rows);
  }, [supabase, profile.id]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [friends, updateScrollState]);

  function scrollFriends(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  const otherFriends = friends.filter((friend) => friend.friend_id !== profile.id);
  const selfName = profileDisplayName(profile);
  const stripItems = [
    {
      key: "me" as const,
      href: "/inicio/perfil",
      username: profile.username,
      name: selfName,
      avatar_url: profile.avatar_url,
      online: true,
    },
    ...otherFriends.map((friend) => ({
      key: friend.friend_id,
      href: profilePath(friend.username),
      username: friend.username,
      name: profileDisplayName(friend),
      avatar_url: friend.avatar_url,
      online: isUserOnline(friend.last_seen_at),
    })),
  ];

  const centered = stripItems.length <= VISIBLE_FRIENDS;

  const carousel = (
    <div
      className={`online-friends-carousel ${edgeToEdge ? "online-friends-carousel--edge" : ""}`}
      style={{ maxWidth: edgeToEdge ? undefined : CAROUSEL_MAX_WIDTH }}
    >
      {canScrollLeft && <ScrollButton direction="left" onClick={() => scrollFriends(-1)} />}
      <div
        ref={scrollRef}
        className={`online-friends-scroll flex gap-5 overflow-x-auto py-3 ${
          centered ? "justify-center" : ""
        } ${edgeToEdge ? "px-4" : ""}`}
      >
        {stripItems.map((item) =>
          item.key === "me" && onOpenCreatePost ? (
            <SelfStoryItem
              key={item.key}
              name={item.name}
              avatarUrl={item.avatar_url}
              onOpenCreatePost={onOpenCreatePost}
            />
          ) : item.key === "me" ? (
            <Link
              key={item.key}
              href={item.href}
              className="online-friend-item flex w-[92px] shrink-0 flex-col items-center gap-2"
            >
              <span className="relative mx-auto inline-flex">
                <span className="online-friend-ring block">
                  <FriendAvatar src={item.avatar_url} name={item.name} />
                </span>
                <span
                  className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--toq-surface)] bg-green-500"
                  title="Online"
                  aria-hidden
                />
              </span>
              <span className="online-friend-name" title={item.name}>
                Você
              </span>
            </Link>
          ) : (
            <FriendStoryItem
              key={item.key}
              name={item.name}
              username={item.username}
              profileHref={item.href}
              avatarUrl={item.avatar_url}
              online={item.online}
            />
          )
        )}
      </div>
      {canScrollRight && <ScrollButton direction="right" onClick={() => scrollFriends(1)} />}
    </div>
  );

  if (embedded) {
    return <div className="online-friends-strip">{carousel}</div>;
  }

  if (edgeToEdge) {
    return <div className="online-friends-strip">{carousel}</div>;
  }

  return (
    <div className="online-friends-strip">
      <FeedPageGrid>{carousel}</FeedPageGrid>
    </div>
  );
}

function useStoryMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const updateMenuPos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 10,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    updateMenuPos();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen, updateMenuPos]);

  function toggleMenu() {
    setMenuOpen((open) => {
      if (!open) updateMenuPos();
      return !open;
    });
  }

  return { menuOpen, setMenuOpen, buttonRef, menuRef, menuPos, toggleMenu };
}

function StoryMenuShell({
  menuRef,
  menuPos,
  children,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuPos: { top: number; left: number };
  children: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{ top: menuPos.top, left: menuPos.left }}
      className="online-friend-self-menu fixed z-[120] w-44 -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] py-1.5 shadow-[0_16px_48px_rgba(5,16,36,0.2)]"
      role="menu"
    >
      {children}
    </div>,
    document.body
  );
}

function menuItemClassName() {
  return "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--toq-navy)] transition hover:bg-[var(--toq-profile-accent-soft)]";
}

function SelfStoryItem({
  name,
  avatarUrl,
  onOpenCreatePost,
}: {
  name: string;
  avatarUrl: string | null;
  onOpenCreatePost: () => void;
}) {
  const { menuOpen, setMenuOpen, buttonRef, menuRef, menuPos, toggleMenu } = useStoryMenu();

  return (
    <>
      <div className="online-friend-item relative flex w-[92px] shrink-0 flex-col items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleMenu}
          className="flex w-full flex-col items-center gap-2"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <span className="relative mx-auto inline-flex">
            <span className={`online-friend-ring block ${menuOpen ? "ring-[var(--toq-profile-accent)]" : ""}`}>
              <FriendAvatar src={avatarUrl} name={name} />
            </span>
            <span
              className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--toq-surface)] bg-[var(--toq-profile-accent)] text-white shadow-sm"
              aria-hidden
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </span>
          <span className="online-friend-name" title={name}>
            Você
          </span>
        </button>
      </div>
      {menuOpen && (
        <StoryMenuShell menuRef={menuRef} menuPos={menuPos}>
          <Link
            href="/inicio/perfil"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className={menuItemClassName()}
          >
            <svg className="h-4 w-4 shrink-0 text-[var(--toq-profile-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="8" r="3" />
              <path d="M4 20c0-3.5 3-6 8-6s8 2.5 8 6" />
            </svg>
            Ver perfil
          </Link>
          <div className="mx-3 border-t border-[var(--toq-border)]" aria-hidden />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenCreatePost();
            }}
            className={menuItemClassName()}
          >
            <svg className="h-4 w-4 shrink-0 text-[var(--toq-profile-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M8 10h8M8 14h5" />
            </svg>
            Postar
          </button>
        </StoryMenuShell>
      )}
    </>
  );
}

function FriendStoryItem({
  name,
  username,
  profileHref,
  avatarUrl,
  online,
}: {
  name: string;
  username: string;
  profileHref: string;
  avatarUrl: string | null;
  online: boolean;
}) {
  const { menuOpen, setMenuOpen, buttonRef, menuRef, menuPos, toggleMenu } = useStoryMenu();

  return (
    <>
      <div className="online-friend-item relative flex w-[92px] shrink-0 flex-col items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleMenu}
          className="flex w-full flex-col items-center gap-2"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Opções de ${name}`}
        >
          <span className="relative mx-auto inline-flex">
            <span className={`online-friend-ring block ${menuOpen ? "ring-[var(--toq-profile-accent)]" : ""}`}>
              <FriendAvatar src={avatarUrl} name={name} />
            </span>
            <span
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--toq-surface)] ${
                online ? "bg-green-500" : "bg-[var(--toq-border)]"
              }`}
              title={online ? "Online" : "Offline"}
              aria-hidden
            />
          </span>
          <span className="online-friend-name" title={name}>
            {name}
          </span>
        </button>
      </div>
      {menuOpen && (
        <StoryMenuShell menuRef={menuRef} menuPos={menuPos}>
          <Link
            href={profileHref}
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className={menuItemClassName()}
          >
            <svg className="h-4 w-4 shrink-0 text-[var(--toq-profile-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="8" r="3" />
              <path d="M4 20c0-3.5 3-6 8-6s8 2.5 8 6" />
            </svg>
            Ver perfil
          </Link>
          <div className="mx-3 border-t border-[var(--toq-border)]" aria-hidden />
          <Link
            href={`/inicio/mensagens?chat=${encodeURIComponent(username)}`}
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className={menuItemClassName()}
          >
            <svg className="h-4 w-4 shrink-0 text-[var(--toq-profile-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M21 15a2 2 0 01-2 2H8l-4 4V5a2 2 0 012-2h13a2 2 0 012 2z" />
            </svg>
            Conversar
          </Link>
        </StoryMenuShell>
      )}
    </>
  );
}

function FriendAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <span className="chat-avatar-frame chat-avatar-frame--xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="chat-avatar-img" />
      </span>
    );
  }

  return (
    <span className="chat-avatar-frame chat-avatar-frame--xl flex items-center justify-center bg-[var(--toq-sky)] text-xl font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
