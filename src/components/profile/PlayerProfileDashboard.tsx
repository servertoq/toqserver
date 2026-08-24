"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GenderType, PlayerLevelType } from "@/lib/profile";
import { profileDisplayName, playerLevelLabel } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";
import type { AddressFields } from "@/lib/address";
import type { FeedPost } from "@/types/feed";
import type { UserPlan } from "@/types/plans";
import type { StaffRole } from "@/types/staff";
import { planLabel } from "@/lib/plans";
import type {
  DominantHand,
  ExperienceBand,
  FavoriteCourt,
  PlayFrequency,
  PlayStyle,
} from "@/lib/profileGame";
import { profilePhotoSlides, type ProfilePhoto } from "@/lib/profilePhotos";
import { ProfilePresenceBadge } from "./ProfilePresenceBadge";
import { ProfilePlayerLevelBadge } from "./ProfilePlayerLevelBadge";
import { StaffBadge } from "@/components/shared/StaffBadge";
import { PostCard } from "@/components/feed/PostCard";
import { AgendaPage } from "@/components/agenda/AgendaPage";
import { ProfileCourtMatchesPanel } from "@/components/profile/ProfileCourtMatchesPanel";
import { ProfilePhotoCarousel } from "./ProfilePhotoCarousel";
import { ProfileMeuJogoGrid } from "./ProfileMeuJogoGrid";
import { ProfileFriendsPreview } from "./ProfileFriendsPreview";
import { ProfilePostsGrid } from "./ProfilePostsGrid";
import { ProfileClubsList } from "./ProfileClubsList";

export type ProfileTab =
  | "resumo"
  | "torneios"
  | "amigos"
  | "publicacoes"
  | "clubes"
  | "agenda"
  | "partidas"
  | "suporte"
  | "mais";

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
  dominantHand?: DominantHand | null;
  experienceBand?: ExperienceBand | null;
  playFrequency?: PlayFrequency | null;
  playStyle?: PlayStyle | null;
  favoriteCourt?: FavoriteCourt | null;
  createdAt: string;
  postCount: number;
  friendCount: number;
  clubCount?: number;
  matchCount?: number;
  lastSeenAt?: string | null;
  address: AddressFields;
  plan?: UserPlan;
  staffRole?: StaffRole | null;
  posts: FeedPost[];
  currentUserId: string;
  isOwnProfile: boolean;
  onLikeToggle: (postId: string, liked: boolean) => Promise<void>;
  headerActions?: ReactNode;
  friendsPanel?: ReactNode;
  supportForm?: ReactNode;
  onResumoSaved?: () => void;
  onAvatarUpdated?: (avatarUrl: string | null) => void;
  initialTab?: ProfileTab;
};

function TabIcon({
  type,
}: {
  type: "grid" | "calendar" | "trophy" | "posts" | "users" | "support" | "club" | "more";
}) {
  const cls = "h-4 w-4 shrink-0";
  switch (type) {
    case "grid":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path strokeLinecap="round" d="M8 2v4M16 2v4M3 10h18" />
        </svg>
      );
    case "trophy":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 4h8v3a4 4 0 01-8 0V4z" />
          <path d="M6 4H4v1a3 3 0 003 3M18 4h2v1a3 3 0 01-3 3" />
          <path d="M12 11v3M9 20h6M10 14h4v3H10z" />
        </svg>
      );
    case "posts":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      );
    case "users":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" />
          <circle cx="17" cy="9" r="2" />
          <path d="M15 20c0-2 1.5-3.5 4-3.5" />
        </svg>
      );
    case "club":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1V9z" />
        </svg>
      );
    case "more":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case "support":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      );
  }
}

function locationLabel(address: AddressFields) {
  const city = address.city?.trim();
  const state = address.state?.trim();
  if (city && state) return `${city} - ${state}`;
  return city || state || null;
}

export function PlayerProfileDashboard({
  profileId,
  username,
  displayName,
  avatarUrl,
  photos = [],
  bio,
  birthDate: _birthDate,
  gender: _gender,
  playerLevel,
  dominantHand = null,
  experienceBand = null,
  playFrequency = null,
  playStyle = null,
  favoriteCourt = null,
  createdAt: _createdAt,
  postCount,
  friendCount,
  clubCount = 0,
  matchCount: _matchCount = 0,
  lastSeenAt,
  address,
  plan = "free",
  staffRole = null,
  posts,
  currentUserId,
  isOwnProfile,
  onLikeToggle,
  headerActions,
  friendsPanel,
  supportForm,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<ProfileTab>(initialTab ?? "resumo");

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const shownName = profileDisplayName({ display_name: displayName, username });
  const slides = profilePhotoSlides(photos, avatarUrl);
  const place = locationLabel(address);

  const navTabs = useMemo(() => {
    const items: {
      id: ProfileTab;
      label: string;
      icon: "grid" | "calendar" | "trophy" | "posts" | "users" | "support" | "club" | "more";
    }[] = [
      { id: "resumo", label: "Resumo", icon: "grid" },
      { id: "torneios", label: "Torneios", icon: "trophy" },
      { id: "amigos", label: "Amigos", icon: "users" },
      { id: "publicacoes", label: "Publicações", icon: "posts" },
      { id: "clubes", label: "Clubes", icon: "club" },
    ];
    if (isOwnProfile) {
      items.push({ id: "mais", label: "Mais", icon: "more" });
    }
    return items;
  }, [isOwnProfile]);

  return (
    <div className="profile-page">
      <div className="profile-dashboard overflow-hidden rounded-3xl border border-[var(--toq-profile-border)] shadow-[0_24px_60px_rgba(5,16,36,0.08)]">
        {/* Mobile-first hero */}
        <div className="border-b border-[var(--toq-profile-border)] bg-[var(--toq-card)]">
          <ProfilePhotoCarousel
            slides={slides}
            alt={shownName}
            className="aspect-[16/10] w-full sm:aspect-[21/9]"
          />
          <div className="px-4 pb-4 pt-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--toq-profile-navy)]">@{username}</h2>
              <ProfilePlayerLevelBadge level={playerLevel} />
              {plan !== "free" && (
                <span className="rounded-full bg-[var(--toq-profile-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-accent)]">
                  {planLabel(plan)}
                </span>
              )}
              <StaffBadge role={staffRole} />
            </div>
            {place && (
              <p className="mt-1.5 flex items-center gap-1 text-sm text-[var(--toq-profile-muted)]">
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                {place}
              </p>
            )}
            {lastSeenAt !== undefined && (
              <div className="mt-2">
                <ProfilePresenceBadge lastSeenAt={lastSeenAt ?? null} />
              </div>
            )}
            {bio?.trim() && (
              <p className="mt-2 text-sm text-[var(--toq-text)]">{bio.trim()}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {isOwnProfile && (
                <>
                  <Link
                    href="/inicio/perfil/editar"
                    className="rounded-xl bg-[var(--toq-profile-accent)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
                  >
                    Editar perfil
                  </Link>
                  <Link
                    href={profilePath(username)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--toq-profile-border)] px-3 py-2 text-xs font-bold text-[var(--toq-profile-navy)] transition hover:bg-slate-50"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Ver meu perfil como outra pessoa
                  </Link>
                </>
              )}
              {headerActions}
            </div>
          </div>

          <nav className="profile-tabs-mobile border-t border-[var(--toq-profile-border)] px-2 py-2" aria-label="Seções do perfil">
            <div className="profile-tabs-scroll">
              {navTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`profile-tab-chip ${tab === item.id ? "profile-tab-chip--active" : ""}`}
                >
                  <TabIcon type={item.icon} />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {tab === "resumo" && (
            <div className="space-y-8">
              <ProfileMeuJogoGrid
                playerLevel={playerLevel}
                dominantHand={dominantHand}
                experienceBand={experienceBand}
                playFrequency={playFrequency}
                playStyle={playStyle}
                favoriteCourt={favoriteCourt}
              />

              <section>
                <p className="profile-section-label">Torneios que participou</p>
                <p className="mt-3 rounded-2xl border border-dashed border-[var(--toq-profile-border)] bg-slate-50/80 px-4 py-6 text-center text-sm text-[var(--toq-profile-muted)]">
                  Nenhum torneio registrado ainda.
                </p>
              </section>

              <ProfileFriendsPreview
                profileId={profileId}
                friendCount={friendCount}
                onSeeAll={() => setTab("amigos")}
              />

              <ProfilePostsGrid posts={posts} onSeeAll={() => setTab("publicacoes")} />

              <ProfileClubsList profileId={profileId} />
            </div>
          )}

          {tab === "torneios" && (
            <div>
              <p className="profile-section-label">Torneios</p>
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--toq-profile-border)] bg-slate-50/80 px-4 py-8 text-center text-sm text-[var(--toq-profile-muted)]">
                Nenhum torneio registrado ainda. Quando houver histórico de participação, ele
                aparecerá aqui.
              </p>
            </div>
          )}

          {tab === "amigos" && (
            <div>
              {friendsPanel ?? (
                <ProfileFriendsPreview
                  profileId={profileId}
                  friendCount={friendCount}
                  limit={50}
                />
              )}
            </div>
          )}

          {tab === "publicacoes" && (
            <div className="space-y-4">
              <p className="profile-section-label">Publicações ({postCount})</p>
              {posts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--toq-profile-border)] bg-slate-50/80 p-8 text-center">
                  <p className="text-sm text-[var(--toq-profile-muted)]">
                    Nenhuma publicação visível.
                  </p>
                </div>
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

          {tab === "clubes" && <ProfileClubsList profileId={profileId} title="Clubes" />}

          {tab === "mais" && isOwnProfile && (
            <div className="space-y-3">
              <p className="profile-section-label">Mais</p>
              <button
                type="button"
                onClick={() => setTab("agenda")}
                className="flex w-full items-center justify-between rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] px-4 py-3 text-sm font-semibold text-[var(--toq-profile-navy)]"
              >
                Agenda
                <TabIcon type="calendar" />
              </button>
              <button
                type="button"
                onClick={() => setTab("partidas")}
                className="flex w-full items-center justify-between rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] px-4 py-3 text-sm font-semibold text-[var(--toq-profile-navy)]"
              >
                Partidas (quadras)
                <TabIcon type="trophy" />
              </button>
              <button
                type="button"
                onClick={() => setTab("suporte")}
                className="flex w-full items-center justify-between rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] px-4 py-3 text-sm font-semibold text-[var(--toq-profile-navy)]"
              >
                Suporte
                <TabIcon type="support" />
              </button>
              <p className="pt-2 text-xs text-[var(--toq-profile-muted)]">
                Nível: {playerLevelLabel(playerLevel)} · Clubes: {clubCount}
              </p>
            </div>
          )}

          {tab === "agenda" && isOwnProfile && <AgendaPage embedded />}
          {tab === "partidas" && (
            <ProfileCourtMatchesPanel userId={profileId} isOwnProfile={isOwnProfile} />
          )}
          {tab === "suporte" && isOwnProfile && supportForm && <div>{supportForm}</div>}
        </div>
      </div>
    </div>
  );
}
