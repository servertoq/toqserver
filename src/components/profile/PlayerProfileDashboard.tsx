"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GenderType, PlayerLevelType } from "@/lib/profile";
import { profileDisplayName } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";
import type { AddressFields } from "@/lib/address";
import type { FeedPost } from "@/types/feed";
import type { UserPlan } from "@/types/plans";
import type { StaffRole } from "@/types/staff";
import { ProfileResumoSection } from "./ProfileResumoSection";
import { ProfilePresenceBadge } from "./ProfilePresenceBadge";
import { ProfileSidebarAvatar } from "./ProfileSidebarAvatar";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfilePlayerLevelBadge } from "./ProfilePlayerLevelBadge";
import { StaffBadge } from "@/components/shared/StaffBadge";
import { PostCard } from "@/components/feed/PostCard";
import { AgendaPage } from "@/components/agenda/AgendaPage";

export type ProfileTab =
  | "resumo"
  | "agenda"
  | "partidas"
  | "publicacoes"
  | "amigos"
  | "suporte";

type Props = {
  profileId: string;
  username: string;
  displayName?: string | null;
  avatarUrl: string | null;
  bio: string;
  birthDate: string;
  gender: GenderType;
  playerLevel: PlayerLevelType;
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

const TABS: { id: ProfileTab; label: string; icon: "grid" | "calendar" | "trophy" | "posts" | "users" | "support" }[] = [
  { id: "resumo", label: "Resumo", icon: "grid" },
  { id: "partidas", label: "Partidas", icon: "trophy" },
  { id: "publicacoes", label: "Publicações", icon: "posts" },
];

function TabIcon({ type }: { type: (typeof TABS)[number]["icon"] | "calendar" }) {
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
    case "support":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      );
  }
}

function StatTile({
  icon,
  value,
  label,
  sub,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <div className="profile-stat-tile flex flex-col items-center justify-center rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] px-4 py-5 text-center">
      <div className="mb-2 text-[var(--toq-profile-accent)]">{icon}</div>
      <p className="text-2xl font-bold text-[var(--toq-profile-navy)]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--toq-profile-navy)]">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-[var(--toq-profile-muted)]">{sub}</p>}
    </div>
  );
}

export function PlayerProfileDashboard({
  profileId,
  username,
  displayName,
  avatarUrl,
  bio,
  birthDate,
  gender,
  playerLevel,
  createdAt,
  postCount,
  friendCount,
  clubCount = 0,
  matchCount = 0,
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
  onResumoSaved,
  onAvatarUpdated,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<ProfileTab>(initialTab ?? "resumo");

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const shownName = profileDisplayName({ display_name: displayName, username });

  const navTabs = useMemo(() => {
    const items: { id: ProfileTab; label: string; icon: "grid" | "calendar" | "trophy" | "posts" | "users" | "support" }[] = [
      ...TABS,
    ];
    if (isOwnProfile) {
      items.splice(1, 0, { id: "agenda", label: "Agenda", icon: "calendar" });
      items.push({ id: "amigos", label: "Amigos", icon: "users" });
      items.push({ id: "suporte", label: "Suporte", icon: "support" });
    }
    return items;
  }, [isOwnProfile]);

  return (
    <div className="profile-page">
      <div className="profile-dashboard overflow-hidden rounded-3xl border border-[var(--toq-profile-border)] shadow-[0_24px_60px_rgba(5,16,36,0.08)]">
        <div className="flex flex-col lg:flex-row">
          {/* Sidebar */}
          <aside className="profile-sidebar shrink-0 border-b border-[var(--toq-profile-border)] p-6 lg:w-60 lg:border-b-0 lg:border-r">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                {isOwnProfile ? (
                  <ProfileSidebarAvatar
                    profileId={profileId}
                    name={shownName}
                    avatarUrl={avatarUrl}
                    isOwnProfile
                    onUpdated={onAvatarUpdated}
                  />
                ) : (
                  <div className="relative">
                    <ProfileAvatar
                      src={avatarUrl}
                      name={shownName}
                      size="lg"
                      ringClassName="ring-4 ring-[var(--toq-profile-accent-soft)]"
                    />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--toq-profile-accent)] text-white shadow-md"
                      title="Jogador Toq"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                      </svg>
                    </span>
                  </div>
                )}
              </div>

              <h2 className="mt-4 text-lg font-bold text-[var(--toq-profile-navy)]">{shownName}</h2>
              <p className="mt-1 text-sm text-[var(--toq-text-muted)]">@{username}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <ProfilePlayerLevelBadge level={playerLevel} />
                <StaffBadge role={staffRole} />
              </div>
              {lastSeenAt !== undefined && (
                <div className="mt-2">
                  <ProfilePresenceBadge lastSeenAt={lastSeenAt ?? null} />
                </div>
              )}

              {headerActions && (
                <div className="profile-sidebar-actions mt-4 w-full">{headerActions}</div>
              )}

              {isOwnProfile && !headerActions && (
                <Link
                  href={profilePath(username)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--toq-profile-border)] px-3 py-2 text-xs font-bold text-[var(--toq-profile-navy)] transition hover:border-[var(--toq-profile-accent)] hover:bg-[var(--toq-profile-accent-soft)]"
                >
                  <svg
                    className="h-4 w-4 shrink-0 text-[var(--toq-profile-accent)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Ver meu perfil como outra pessoa
                </Link>
              )}
            </div>

            <nav className="mt-8 hidden space-y-0.5 lg:block">
              {navTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`profile-nav-btn flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition lg:justify-start ${
                    tab === item.id ? "profile-nav-btn--active" : ""
                  }`}
                >
                  <TabIcon type={item.icon} />
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <nav className="profile-tabs-mobile mb-5 lg:hidden" aria-label="Seções do perfil">
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
            {tab === "resumo" && (
              <div className="space-y-6">
                <ProfileResumoSection
                  profileId={profileId}
                  birthDate={birthDate}
                  gender={gender}
                  bio={bio}
                  playerLevel={playerLevel}
                  plan={plan}
                  address={address}
                  createdAt={createdAt}
                  displayName={displayName}
                  username={username}
                  isOwnProfile={isOwnProfile}
                  onSaved={onResumoSaved}
                />

                <section>
                  <p className="profile-section-label">Desempenho geral</p>
                  <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <StatTile
                      icon={
                        <svg className="mx-auto h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M8 4h8v3a4 4 0 01-8 0V4z" />
                          <path d="M6 4H4v1a3 3 0 003 3M18 4h2v1a3 3 0 01-3 3" />
                          <path d="M12 11v3M9 20h6M10 14h4v3H10z" />
                        </svg>
                      }
                      value={matchCount}
                      label="Torneios e partidas"
                      sub="participou"
                    />
                    <StatTile
                      icon={
                        <svg className="mx-auto h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 17 5.5 21 7.5 13.5 2 9 9 9" />
                        </svg>
                      }
                      value={friendCount}
                      label="Amigos"
                      sub="na rede"
                    />
                    <StatTile
                      icon={
                        <svg className="mx-auto h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                          <path d="M8 10h8M8 14h5" />
                        </svg>
                      }
                      value={postCount}
                      label="Publicações"
                      sub="no perfil"
                    />
                    <StatTile
                      icon={
                        <svg className="mx-auto h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1V9z" />
                        </svg>
                      }
                      value={clubCount}
                      label="Clubes"
                      sub="participa"
                    />
                  </div>
                </section>
              </div>
            )}

            {tab === "agenda" && isOwnProfile && <AgendaPage embedded />}

            {tab === "partidas" && (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--toq-profile-border)] bg-slate-50/80 px-6 text-center">
                <div className="mb-4 text-[var(--toq-profile-accent)]">
                  <TabIcon type="trophy" />
                </div>
                <p className="text-base font-bold text-[var(--toq-profile-navy)]">Partidas em breve</p>
                <p className="mt-2 max-w-sm text-sm text-[var(--toq-profile-muted)]">
                  O histórico de jogos, placares e adversários ficará disponível nesta aba quando o
                  módulo de partidas for lançado.
                </p>
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

            {tab === "amigos" && isOwnProfile && friendsPanel && (
              <div>{friendsPanel}</div>
            )}

            {tab === "suporte" && isOwnProfile && supportForm && (
              <div>{supportForm}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
