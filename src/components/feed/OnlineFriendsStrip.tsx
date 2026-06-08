"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { profilePath } from "@/lib/publicProfile";
import { isUserOnline } from "@/lib/presence";
import { FeedPageGrid } from "@/components/feed/FeedPageGrid";

type FriendCard = {
  friend_id: string;
  username: string;
  avatar_url: string | null;
  last_seen_at: string | null;
};

export function OnlineFriendsStrip() {
  const supabase = createClient();
  const { id: userId } = useAppProfile();
  const [friends, setFriends] = useState<FriendCard[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("friendships")
      .select(
        `
        friend_id,
        profile:profiles!friendships_friend_id_fkey(username, avatar_url, last_seen_at)
      `
      )
      .eq("user_id", userId)
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
        avatar_url: p?.avatar_url ?? null,
        last_seen_at: p?.last_seen_at ?? null,
      };
    });

    setFriends(rows);
  }, [supabase, userId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  if (friends.length === 0) return null;

  return (
    <div className="border-t border-[var(--toq-border)] bg-white/90">
      <FeedPageGrid>
        <div
          ref={scrollRef}
          className="online-friends-scroll flex gap-4 overflow-x-auto py-3"
        >
          {friends.map((friend) => {
          const online = isUserOnline(friend.last_seen_at);
          return (
            <Link
              key={friend.friend_id}
              href={profilePath(friend.username)}
              className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
            >
              <span className="relative inline-block">
                <span className="online-friend-ring block">
                  <FriendAvatar src={friend.avatar_url} name={friend.username} />
                </span>
                <span
                  className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                    online ? "bg-green-500" : "bg-white shadow-sm"
                  }`}
                  title={online ? "Online" : "Offline"}
                  aria-hidden
                />
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium text-[var(--toq-navy)]">
                {friend.username}
              </span>
            </Link>
          );
          })}
        </div>
      </FeedPageGrid>
    </div>
  );
}

function FriendAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-14 w-14 rounded-full border-2 border-white object-cover"
      />
    );
  }
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-[var(--toq-sky)] text-lg font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
