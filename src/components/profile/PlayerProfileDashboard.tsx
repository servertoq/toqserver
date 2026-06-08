"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { formatAddressLines, hasAddress } from "@/lib/address";
import {
  formatAge,
  formatMemberSince,
  genderLabel,
  profilePath,
} from "@/lib/publicProfile";
import { computeEngagementStats } from "@/lib/profileStats";
import type { GenderType } from "@/lib/profile";
import type { AddressFields } from "@/lib/address";
import type { FeedPost } from "@/types/feed";
import { ProfileEngagementRing } from "./ProfileEngagementRing";
import { ProfilePerformanceChart } from "./ProfilePerformanceChart";
import { ProfilePresenceBadge } from "./ProfilePresenceBadge";
import { PostCard } from "@/components/feed/PostCard";

export type ProfileTab =
  | "resumo"
  | "desempenho"
  | "historico"
  | "partidas"
  | "publicacoes"
  | "amigos"
  | "editar";

type Props = {
  username: string;
  avatarUrl: string | null;
  bio: string;
  birthDate: string;
  gender: GenderType;
  createdAt: string;
  postCount: number;
  friendCount: number;
  lastSeenAt?: string | null;
  address: AddressFields;
  posts: FeedPost[];
  currentUserId: string;
  isOwnProfile: boolean;
  onLikeToggle: (postId: string, liked: boolean) => Promise<void>;
  headerActions?: ReactNode;
  friendsPanel?: ReactNode;
  editForm?: ReactNode;
};

const TABS: { id: ProfileTab; label: string; icon: "grid" | "chart" | "clock" | "trophy" | "posts" | "users" | "edit" }[] = [
  { id: "resumo", label: "Resumo", icon: "grid" },
  { id: "desempenho", label: "Desempenho", icon: "chart" },
  { id: "historico", label: "Histórico", icon: "clock" },
  { id: "partidas", label: "Partidas", icon: "trophy" },
  { id: "publicacoes", label: "Publicações", icon: "posts" },
];

function TabIcon({ type }: { type: (typeof TABS)[number]["icon"] }) {
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
    case "chart":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 17 9 11 13 15 21 7" />
        </svg>
      );
    case "clock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
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
    case "edit":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
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
    <div className="profile-stat-tile flex flex-col items-center justify-center rounded-2xl border border-[var(--toq-profile-border)] bg-white px-4 py-5 text-center">
      <div className="mb-2 text-[var(--toq-profile-accent)]">{icon}</div>
      <p className="text-2xl font-bold text-[var(--toq-profile-navy)]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--toq-profile-navy)]">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-[var(--toq-profile-muted)]">{sub}</p>}
    </div>
  );
}

export function PlayerProfileDashboard({
  username,
  avatarUrl,
  bio,
  birthDate,
  gender,
  createdAt,
  postCount,
  friendCount,
  lastSeenAt,
  address,
  posts,
  currentUserId,
  isOwnProfile,
  onLikeToggle,
  headerActions,
  friendsPanel,
  editForm,
}: Props) {
  const [tab, setTab] = useState<ProfileTab>("resumo");
  const stats = useMemo(() => computeEngagementStats(posts), [posts]);

  const displayName = username.charAt(0).toUpperCase() + username.slice(1);
  const age = formatAge(birthDate);

  const navTabs = useMemo(() => {
    const items = [...TABS];
    if (isOwnProfile) {
      items.push({ id: "amigos" as const, label: "Amigos", icon: "users" as const });
      items.push({ id: "editar" as const, label: "Editar", icon: "edit" as const });
    }
    return items;
  }, [isOwnProfile]);

  return (
    <div className="profile-page space-y-6">
      <header className="profile-hero">
        <p className="profile-hero-kicker">TOQ</p>
        <h1 className="profile-hero-title">
          SEU JOGO.
          <br />
          SEUS NÚMEROS.
        </h1>
        <p className="profile-hero-sub">Evolua com dados reais.</p>
      </header>

      <div className="profile-dashboard overflow-hidden rounded-3xl border border-[var(--toq-profile-border)] bg-white shadow-[0_24px_60px_rgba(5,16,36,0.08)]">
        <div className="flex flex-col lg:flex-row">
          {/* Sidebar */}
          <aside className="profile-sidebar shrink-0 border-b border-[var(--toq-profile-border)] p-6 lg:w-64 lg:border-b-0 lg:border-r">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="relative">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="profile-avatar h-24 w-24 rounded-full object-cover ring-4 ring-[var(--toq-profile-accent-soft)]"
                  />
                ) : (
                  <div className="profile-avatar flex h-24 w-24 items-center justify-center rounded-full bg-[var(--toq-profile-accent)] text-3xl font-bold text-white ring-4 ring-[var(--toq-profile-accent-soft)]">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--toq-profile-accent)] text-white shadow-md"
                  title="Jogador Toq"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                  </svg>
                </span>
              </div>

              <h2 className="mt-4 text-lg font-bold text-[var(--toq-profile-navy)]">{displayName}</h2>
              <p className="mt-1 text-sm text-[var(--toq-profile-muted)]">
                @{username} · {age} anos
              </p>
              <p className="mt-0.5 text-xs text-[var(--toq-profile-muted)]">{genderLabel(gender)}</p>
              {lastSeenAt !== undefined && (
                <div className="mt-2">
                  <ProfilePresenceBadge lastSeenAt={lastSeenAt ?? null} />
                </div>
              )}

              {headerActions && (
                <div className="profile-sidebar-actions mt-4 w-full">{headerActions}</div>
              )}
            </div>

            <nav className="mt-8 space-y-1">
              {navTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`profile-nav-btn flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    tab === item.id
                      ? "bg-[var(--toq-profile-accent-soft)] text-[var(--toq-profile-accent)]"
                      : "text-[var(--toq-profile-muted)] hover:bg-slate-50 hover:text-[var(--toq-profile-navy)]"
                  }`}
                >
                  <TabIcon type={item.icon} />
                  {item.label}
                </button>
              ))}
            </nav>

            <p className="profile-tagline mt-8 hidden text-center text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--toq-profile-muted)] lg:block">
              Jogue mais. Resolva menos.
            </p>
          </aside>

          {/* Main */}
          <div className="min-w-0 flex-1 p-6 lg:p-8">
            {tab === "resumo" && (
              <div className="space-y-6">
                <section>
                  <p className="profile-section-label">Desempenho geral</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="profile-stat-tile flex items-center justify-center rounded-2xl border border-[var(--toq-profile-border)] bg-white py-6">
                      <ProfileEngagementRing
                        value={stats.engagementRate}
                        label="Engajamento"
                        sublabel="nas publicações"
                      />
                    </div>
                    <StatTile
                      icon={
                        <svg className="mx-auto h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M8 4h8v3a4 4 0 01-8 0V4z" />
                          <path d="M6 4H4v1a3 3 0 003 3M18 4h2v1a3 3 0 01-3 3" />
                          <path d="M12 11v3M9 20h6M10 14h4v3H10z" />
                        </svg>
                      }
                      value={stats.totalLikes}
                      label="Curtidas"
                      sub="recebidas"
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
                  </div>
                </section>

                <ProfilePerformanceChart data={stats.monthlyActivity} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniInfo label="Publicações" value={String(postCount)} />
                  <MiniInfo label="Comentários recebidos" value={String(stats.totalComments)} />
                </div>
              </div>
            )}

            {tab === "desempenho" && (
              <div className="space-y-6">
                <section>
                  <p className="profile-section-label">Métricas de atividade</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MiniInfo label="Taxa de engajamento" value={`${stats.engagementRate}%`} large />
                    <MiniInfo label="Curtidas totais" value={String(stats.totalLikes)} large />
                    <MiniInfo label="Comentários" value={String(stats.totalComments)} large />
                    <MiniInfo label="Publicações" value={String(postCount)} large />
                  </div>
                </section>
                <ProfilePerformanceChart
                  data={stats.monthlyActivity}
                  title="Evolução de publicações (6 meses)"
                />
                <div className="rounded-2xl border border-dashed border-[var(--toq-profile-border)] bg-[var(--toq-profile-accent-soft)]/40 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-[var(--toq-profile-navy)]">
                    Partidas e ranking do clube
                  </p>
                  <p className="mt-1 text-xs text-[var(--toq-profile-muted)]">
                    Vitórias, aproveitamento e posição no ranking serão exibidos aqui em breve.
                  </p>
                </div>
              </div>
            )}

            {tab === "historico" && (
              <div className="space-y-5">
                <p className="profile-section-label">Sobre o jogador</p>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <InfoRow label="Usuário" value={`@${username}`} />
                  <InfoRow label="Membro desde" value={formatMemberSince(createdAt)} />
                  <InfoRow label="Idade" value={`${age} anos`} />
                  <InfoRow label="Sexo" value={genderLabel(gender)} />
                </dl>

                {hasAddress(address) && (
                  <div className="rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-profile-accent-soft)]/30 px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
                      Localização
                    </p>
                    <address className="mt-2 space-y-0.5 text-sm not-italic text-[var(--toq-profile-navy)]">
                      {formatAddressLines(address).map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--toq-profile-border)] bg-white px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">Bio</p>
                  {bio ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-profile-navy)]">
                      {bio}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-[var(--toq-profile-muted)]">
                      {isOwnProfile
                        ? "Adicione uma bio na aba Editar para contar sua história no tênis."
                        : "Este jogador ainda não adicionou uma bio."}
                    </p>
                  )}
                </div>

                {isOwnProfile && (
                  <Link
                    href={profilePath(username)}
                    className="inline-flex text-sm font-semibold text-[var(--toq-profile-accent)] hover:underline"
                  >
                    Ver como outros jogadores veem seu perfil →
                  </Link>
                )}
              </div>
            )}

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

            {tab === "editar" && isOwnProfile && editForm && (
              <div>
                <p className="profile-section-label mb-4">Editar perfil</p>
                {editForm}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniInfo({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--toq-profile-border)] bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-bold text-[var(--toq-profile-navy)] ${large ? "text-2xl" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--toq-profile-border)] bg-white px-4 py-3">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--toq-profile-navy)]">{value}</dd>
    </div>
  );
}
