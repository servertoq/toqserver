"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { profilePath } from "@/lib/publicProfile";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type FriendPreview = {
  friend_id: string;
  username: string;
  avatar_url: string | null;
};

type Props = {
  profileId: string;
  friendCount: number;
  onSeeAll?: () => void;
  limit?: number;
};

export function ProfileFriendsPreview({
  profileId,
  friendCount,
  onSeeAll,
  limit = 8,
}: Props) {
  const supabase = createClient();
  const [friends, setFriends] = useState<FriendPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_profile_friends_preview", {
        p_profile_id: profileId,
        p_limit: limit,
      });
      if (cancelled) return;
      setFriends(
        (data ?? []).map((r: FriendPreview) => ({
          friend_id: r.friend_id,
          username: r.username,
          avatar_url: r.avatar_url,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, limit, supabase]);

  const extra = Math.max(0, friendCount - friends.length);

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <p className="profile-section-label">Amigos</p>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-semibold text-[var(--toq-profile-accent)]"
          >
            Ver todos
          </button>
        )}
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-[var(--toq-profile-muted)]">Carregando…</p>
      ) : friends.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--toq-profile-muted)]">Nenhum amigo ainda.</p>
      ) : (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {friends.map((f) => (
            <Link
              key={f.friend_id}
              href={profilePath(f.username)}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <ProfileAvatar src={f.avatar_url} name={f.username} size="md" />
              <span className="w-full truncate text-center text-[10px] font-medium text-[var(--toq-profile-navy)]">
                @{f.username}
              </span>
            </Link>
          ))}
          {extra > 0 && (
            <button
              type="button"
              onClick={onSeeAll}
              className="flex w-16 shrink-0 flex-col items-center justify-center gap-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[var(--toq-profile-navy)]">
                +{extra}
              </span>
              <span className="text-[10px] font-medium text-[var(--toq-profile-muted)]">Mais</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
