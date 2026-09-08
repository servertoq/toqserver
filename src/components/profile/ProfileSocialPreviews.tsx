"use client";

import Link from "next/link";
import { groupDetailHref } from "@/lib/communityGroup";
import { formatMemberSince } from "@/lib/publicProfile";
import { profilePath } from "@/lib/publicProfile";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { FeedPost } from "@/types/feed";
import type { ProfileClubPreview, ProfileFriendPreview } from "@/types/profile";

function SectionHead({
  title,
  href,
  count,
  allLabel = "Ver todos",
}: {
  title: string;
  href?: string;
  count?: number;
  allLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="profile-section-label">
        {title}
        {typeof count === "number" ? ` (${count})` : ""}
      </p>
      {href && (
        <Link href={href} className="text-xs font-semibold text-[var(--toq-profile-accent)] hover:underline">
          {allLabel}
        </Link>
      )}
    </div>
  );
}

export function ProfileFriendsPreview({
  friends,
  friendCount,
  onSeeAll,
}: {
  friends: ProfileFriendPreview[];
  friendCount: number;
  onSeeAll?: () => void;
}) {
  const extra = Math.max(0, friendCount - friends.length);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="profile-section-label">Amigos</p>
        {onSeeAll && friendCount > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-semibold text-[var(--toq-profile-accent)] hover:underline"
          >
            Ver todos
          </button>
        )}
      </div>
      {friends.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--toq-profile-muted)]">Nenhum amigo para mostrar.</p>
      ) : (
        <ul className="profile-friends-row mt-4">
          {friends.map((friend) => (
            <li key={friend.friend_id}>
              <Link href={profilePath(friend.username)} className="profile-friends-item">
                <ProfileAvatar src={friend.avatar_url} name={friend.username} size="md" />
                <span>@{friend.username}</span>
              </Link>
            </li>
          ))}
          {extra > 0 && onSeeAll && (
            <li>
              <button type="button" onClick={onSeeAll} className="profile-friends-more">
                +{extra} mais
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function ProfilePostsPreview({
  posts,
  postCount,
  onSeeAll,
}: {
  posts: FeedPost[];
  postCount: number;
  onSeeAll?: () => void;
}) {
  const thumbs = posts
    .map((post) => {
      const media = post.images.find((img) => img.url);
      return media
        ? { id: post.id, url: media.url, isVideo: media.media_type === "video", title: post.title || post.body }
        : null;
    })
    .filter((item): item is { id: string; url: string; isVideo: boolean; title: string } => Boolean(item))
    .slice(0, 8);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="profile-section-label">Publicações</p>
        {onSeeAll && postCount > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-semibold text-[var(--toq-profile-accent)] hover:underline"
          >
            Ver todas
          </button>
        )}
      </div>
      {thumbs.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--toq-profile-muted)]">Nenhuma publicação com mídia ainda.</p>
      ) : (
        <ul className="profile-posts-row mt-4">
          {thumbs.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={onSeeAll} className="profile-posts-thumb" aria-label="Ver publicação">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" />
                {item.isVideo && (
                  <span className="profile-posts-play" aria-hidden>
                    ▶
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProfileClubsList({
  clubs,
  clubCount,
  onSeeAll,
  compact = false,
}: {
  clubs: ProfileClubPreview[];
  clubCount: number;
  onSeeAll?: () => void;
  compact?: boolean;
}) {
  const list = compact ? clubs.slice(0, 4) : clubs;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="profile-section-label">Clubes que participa</p>
        {onSeeAll && clubCount > list.length && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-semibold text-[var(--toq-profile-accent)] hover:underline"
          >
            Ver todos
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--toq-profile-muted)]">Ainda não participa de clubes.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {list.map((club) => (
            <li key={club.community_id}>
              <Link href={groupDetailHref(club.kind, club.slug)} className="profile-club-row">
                {club.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={club.cover_image_url} alt="" className="profile-club-row-cover" />
                ) : (
                  <span className="profile-club-row-fallback">{club.name.charAt(0)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--toq-profile-navy)]">
                    {club.name}
                  </span>
                  {club.joined_at && (
                    <span className="block text-xs text-[var(--toq-profile-muted)]">
                      Membro desde {formatMemberSince(club.joined_at)}
                    </span>
                  )}
                </span>
                <svg className="h-4 w-4 shrink-0 text-[var(--toq-profile-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProfileTournamentsEmpty() {
  return (
    <section>
      <SectionHead title="Torneios que participou" />
      <p className="mt-4 text-sm text-[var(--toq-profile-muted)]">
        Os torneios em que este jogador participar vão aparecer aqui.
      </p>
    </section>
  );
}
