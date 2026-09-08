"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HScroll } from "@/components/shared/HScroll";
import type {
  DominantHand,
  ExperienceBand,
  FavoriteCourt,
  GenderType,
  PlayFrequency,
  PlayerLevelType,
  PlayStyle,
} from "@/lib/profile";
import { profileDisplayName } from "@/lib/profile";
import { formatProfileLocation, profilePath } from "@/lib/publicProfile";
import type { AddressFields } from "@/lib/address";
import type { FeedPost } from "@/types/feed";
import type { UserPlan } from "@/types/plans";
import type { StaffRole } from "@/types/staff";
import type { ProfileClubPreview, ProfileFriendPreview, ProfilePhoto } from "@/types/profile";
import { profileCarouselUrls } from "@/lib/profilePhotos";
import { ProfilePresenceBadge } from "./ProfilePresenceBadge";
import { ProfilePlayerLevelBadge } from "./ProfilePlayerLevelBadge";
import { StaffBadge } from "@/components/shared/StaffBadge";
import { PostCard } from "@/components/feed/PostCard";
import { AgendaPage } from "@/components/agenda/AgendaPage";
import { ProfileCourtMatchesPanel } from "@/components/profile/ProfileCourtMatchesPanel";
import { ProfilePhotoCarousel } from "./ProfilePhotoCarousel";
import { ProfileEditPanel } from "./ProfileEditPanel";
import { ProfileMeuJogoSection } from "./ProfileMeuJogoSection";
import {
  ProfileClubsList,
  ProfileFriendsPreview,
  ProfilePostsPreview,
  ProfileTournamentsEmpty,
} from "./ProfileSocialPreviews";

export type ProfileTab =
  | "resumo"
  | "agenda"
  | "partidas"
  | "torneios"
  | "publicacoes"
  | "amigos"
  | "clubes"
  | "suporte";

type Props = {
  profileId: string;
  username: string;
  displayName?: string | null;
  avatarUrl: string | null;
  photos?: ProfilePhoto[];
  bio: string;
  birthDate: string;
  gender: GenderType;
  playerLevel: PlayerLevelType;
  createdAt: string;
  postCount: number;
  friendCount: number;
  clubCount?: number;
  lastSeenAt?: string | null;
  address: AddressFields;
  plan?: UserPlan;
  staffRole?: StaffRole | null;
  dominantHand?: DominantHand | null;
  experienceBand?: ExperienceBand | null;
  playFrequency?: PlayFrequency | null;
  playStyle?: PlayStyle | null;
  favoriteCourt?: FavoriteCourt | null;
  friendsPreview?: ProfileFriendPreview[];
  clubs?: ProfileClubPreview[];
  posts: FeedPost[];
  currentUserId: string;
  isOwnProfile: boolean;
  onLikeToggle: (postId: string, liked: boolean) => Promise<void>;
  headerActions?: ReactNode;
  friendsPanel?: ReactNode;
  supportForm?: ReactNode;
  onResumoSaved?: () => void;
  onAvatarUpdated?: (avatarUrl: string | null) => void;
  onPhotosUpdated?: (photos: ProfilePhoto[], avatarUrl: string | null) => void;
  initialTab?: ProfileTab;
};

const TAB_ICONS = {
  grid: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  calendar: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path strokeLinecap="round" d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  ),
  trophy: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 4h8v3a4 4 0 01-8 0V4z" />
      <path d="M6 4H4v1a3 3 0 003 3M18 4h2v1a3 3 0 01-3 3" />
      <path d="M12 11v3M9 20h6M10 14h4v3H10z" />
    </svg>
  ),
  posts: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  ),
  users: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2" />
      <path d="M15 20c0-2 1.5-3.5 4-3.5" />
    </svg>
  ),
  clubs: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1V9z" />
    </svg>
  ),
  support: (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  ),
} as const;

export function PlayerProfileDashboard({
  profileId,
  username,
  displayName,
  avatarUrl,
  photos = [],
  bio,
  gender,
  playerLevel,
  createdAt,
  postCount,
  friendCount,
  clubCount = 0,
  lastSeenAt,
  address,
  plan = "free",
  staffRole = null,
  dominantHand = null,
  experienceBand = null,
  playFrequency = null,
  playStyle = null,
  favoriteCourt = null,
  friendsPreview = [],
  clubs = [],
  posts,
  currentUserId,
  isOwnProfile,
  onLikeToggle,
  headerActions,
  friendsPanel,
  supportForm,
  onResumoSaved,
  onAvatarUpdated,
  onPhotosUpdated,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<ProfileTab>(initialTab ?? "resumo");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const shownName = profileDisplayName({ display_name: displayName, username });
  const locationLabel = formatProfileLocation(address.city, address.state);
  const carouselUrls = profileCarouselUrls(photos, avatarUrl);

  const navTabs = useMemo(() => {
    const items: { id: ProfileTab; label: string; icon: keyof typeof TAB_ICONS }[] = [
      { id: "resumo", label: "Resumo", icon: "grid" },
      { id: "torneios", label: "Torneios", icon: "trophy" },
      { id: "amigos", label: "Amigos", icon: "users" },
      { id: "publicacoes", label: "Publicações", icon: "posts" },
      { id: "clubes", label: "Clubes", icon: "clubs" },
    ];
    if (isOwnProfile) {
      items.splice(2, 0, { id: "agenda", label: "Agenda", icon: "calendar" });
      items.splice(3, 0, { id: "partidas", label: "Partidas", icon: "trophy" });
      items.push({ id: "suporte", label: "Suporte", icon: "support" });
    } else {
      items.splice(2, 0, { id: "partidas", label: "Partidas", icon: "trophy" });
    }
    return items;
  }, [isOwnProfile]);

  if (editing && isOwnProfile) {
    return (
      <div className="profile-page">
        <div className="profile-dashboard">
          <div className="profile-edit-wrap">
            <ProfileEditPanel
              profileId={profileId}
              username={username}
              photos={photos}
              bio={bio}
              gender={gender}
              playerLevel={playerLevel}
              address={address}
              createdAt={createdAt}
              plan={plan}
              dominantHand={dominantHand}
              experienceBand={experienceBand}
              playFrequency={playFrequency}
              playStyle={playStyle}
              favoriteCourt={favoriteCourt}
              onClose={() => setEditing(false)}
              onPhotosChanged={(nextPhotos, nextAvatar) => {
                onPhotosUpdated?.(nextPhotos, nextAvatar);
                onAvatarUpdated?.(nextAvatar);
              }}
              onSaved={() => {
                onResumoSaved?.();
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-dashboard">
        <div className="profile-hero-card">
          <ProfilePhotoCarousel
            urls={carouselUrls}
            name={shownName}
            onEdit={isOwnProfile && !headerActions ? () => setEditing(true) : undefined}
          />

          <div className="profile-identity">
            <h2 className="profile-identity-name">@{username}</h2>
            <div className="profile-identity-badges">
              <ProfilePlayerLevelBadge level={playerLevel} />
              <StaffBadge role={staffRole} />
            </div>
            {locationLabel && (
              <p className="profile-identity-location">
                <svg className="h-4 w-4 shrink-0 text-[var(--toq-profile-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                {locationLabel}
              </p>
            )}
            {lastSeenAt !== undefined && (
              <div className="mt-2 flex justify-center">
                <ProfilePresenceBadge lastSeenAt={lastSeenAt ?? null} />
              </div>
            )}
          </div>

          <div className="profile-hero-actions">
            {isOwnProfile && !headerActions && (
              <Link href={profilePath(username)} className="profile-outline-btn">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Ver meu perfil como outra pessoa
              </Link>
            )}
            {headerActions}
          </div>
        </div>

        <nav className="profile-tabs-bar" aria-label="Seções do perfil">
          <HScroll innerClassName="profile-tabs-scroll">
            {navTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`profile-tab-link ${tab === item.id ? "is-active" : ""}`}
              >
                <span className="profile-tab-icon">{TAB_ICONS[item.icon]}</span>
                {item.label}
              </button>
            ))}
          </HScroll>
        </nav>

        <div className="profile-main">
          {tab === "resumo" && (
            <div className="space-y-8">
              {bio ? (
                <p className="text-sm leading-relaxed text-[var(--toq-profile-navy)]">{bio}</p>
              ) : null}
              <ProfileMeuJogoSection
                playerLevel={playerLevel}
                dominantHand={dominantHand}
                experienceBand={experienceBand}
                playFrequency={playFrequency}
                playStyle={playStyle}
                favoriteCourt={favoriteCourt}
                isOwnProfile={false}
              />
              <ProfileTournamentsEmpty />
              <ProfileFriendsPreview
                friends={friendsPreview}
                friendCount={friendCount}
                onSeeAll={() => setTab("amigos")}
              />
              <ProfilePostsPreview
                posts={posts}
                postCount={postCount}
                onSeeAll={() => setTab("publicacoes")}
              />
              <ProfileClubsList
                clubs={clubs}
                clubCount={clubCount}
                compact
                onSeeAll={() => setTab("clubes")}
              />
            </div>
          )}

          {tab === "agenda" && isOwnProfile && <AgendaPage embedded />}

          {tab === "partidas" && (
            <ProfileCourtMatchesPanel userId={profileId} isOwnProfile={isOwnProfile} />
          )}

          {tab === "torneios" && <ProfileTournamentsEmpty />}

          {tab === "publicacoes" && (
            <div className="space-y-4">
              <p className="profile-section-label">Publicações ({postCount})</p>
              {posts.length === 0 ? (
                <p className="text-sm text-[var(--toq-profile-muted)]">Nenhuma publicação visível.</p>
              ) : (
                <ul className="space-y-4">
                  {posts.map((post) => (
                    <li key={post.id}>
                      <PostCard
                        post={post}
                        currentUserId={currentUserId}
                        onLikeToggle={onLikeToggle}
                        onCommentCountChange={() => {}}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "amigos" &&
            (isOwnProfile && friendsPanel ? (
              friendsPanel
            ) : (
              <ProfileFriendsPreview friends={friendsPreview} friendCount={friendCount} />
            ))}

          {tab === "clubes" && <ProfileClubsList clubs={clubs} clubCount={clubCount} />}

          {tab === "suporte" && isOwnProfile && supportForm}
        </div>
      </div>
    </div>
  );
}
