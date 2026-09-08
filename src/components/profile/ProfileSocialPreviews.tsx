"use client";

import Link from "next/link";
import { groupDetailHref } from "@/lib/communityGroup";
import { formatMemberSince } from "@/lib/publicProfile";
import { profilePath } from "@/lib/publicProfile";
import { HScroll } from "@/components/shared/HScroll";
import { ProfileAvatar } from "./ProfileAvatar";
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
        <HScroll innerClassName="profile-friends-row mt-4">
          {friends.map((friend) => (
            <div key={friend.friend_id}>
              <Link href={profilePath(friend.username)} className="profile-friends-item">
                <ProfileAvatar src={friend.avatar_url} name={friend.username} size="md" />
                <span>@{friend.username}</span>
              </Link>
            </div>
          ))}
          {extra > 0 && onSeeAll && (
            <div>
              <button type="button" onClick={onSeeAll} className="profile-friends-more">
                +{extra} mais
              </button>
            </div>
          )}
        </HScroll>
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
        <HScroll innerClassName="profile-posts-row mt-4">
          {thumbs.map((item) => (
            <div key={item.id}>
              <button type="button" onClick={onSeeAll} className="profile-posts-thumb" aria-label="Ver publicação">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" />
                {item.isVideo && (
                  <span className="profile-posts-play" aria-hidden>
                    ▶
                  </span>
                )}
              </button>
            </div>
          ))}
        </HScroll>
      )}
    </section>
  );
}

function MembershipList({
  title,
  empty,
  items,
  compact,
  onSeeAll,
}: {
  title: string;
  empty: string;
  items: ProfileClubPreview[];
  compact?: boolean;
  onSeeAll?: () => void;
}) {
  const list = compact ? items.slice(0, 4) : items;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="profile-section-label">{title}</p>
        {onSeeAll && items.length > list.length && (
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
        <p className="mt-4 text-sm text-[var(--toq-profile-muted)]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {list.map((item) => (
            <li key={item.community_id}>
              <Link href={groupDetailHref(item.kind, item.slug)} className="profile-club-row">
                {item.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cover_image_url} alt="" className="profile-club-row-cover" />
                ) : (
                  <span className="profile-club-row-fallback">{item.name.charAt(0)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--toq-profile-navy)]">
                    {item.name}
                  </span>
                  {item.joined_at && (
                    <span className="block text-xs text-[var(--toq-profile-muted)]">
                      Membro desde {formatMemberSince(item.joined_at)}
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

export function ProfileClubsList({
  clubs,
  onSeeAll,
  compact = false,
}: {
  clubs: ProfileClubPreview[];
  clubCount?: number;
  onSeeAll?: () => void;
  compact?: boolean;
}) {
  const clubItems = clubs.filter((item) => item.kind === "club");
  const communityItems = clubs.filter((item) => item.kind === "community");

  return (
    <div className="space-y-8">
      <MembershipList
        title="Clubes que participa"
        empty="Ainda não participa de clubes."
        items={clubItems}
        compact={compact}
        onSeeAll={onSeeAll}
      />
      <MembershipList
        title="Comunidades"
        empty="Ainda não participa de comunidades."
        items={communityItems}
        compact={compact}
        onSeeAll={onSeeAll}
      />
    </div>
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
