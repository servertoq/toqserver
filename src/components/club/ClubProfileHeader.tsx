"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PostBody } from "@/components/feed/PostBody";
import { ClubFavoriteButton } from "@/components/club/ClubFavoriteButton";
import { ReportButton } from "@/components/report/ReportButton";
import { CommunityCoverCarousel } from "@/components/community/CommunityCoverCarousel";
import { groupVisibilityLabel, isOwner, memberRoleLabel } from "@/lib/community";
import { communityCoverSlides } from "@/lib/communityGallery";
import type { Community, CommunityGroupKind, CommunityMemberRole } from "@/types/community";

type Props = {
  community: Community;
  groupKind: CommunityGroupKind;
  myRole: CommunityMemberRole | null;
  isClubProfessor: boolean;
  isFavorite: boolean;
  onFavoriteChange: (fav: boolean) => void;
  onOpenSettings: () => void;
  onOpenGalleryManager: () => void;
  onLeave: () => void;
  profileId: string;
  /** Compact cover + print-style card (mobile). */
  variant?: "mobile" | "desktop";
  joinSlot?: ReactNode;
  infoSlot?: ReactNode;
};

function MembersIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function ClubProfileHeader({
  community,
  groupKind,
  myRole,
  isClubProfessor,
  isFavorite,
  onFavoriteChange,
  onOpenSettings,
  onOpenGalleryManager,
  onLeave,
  profileId,
  variant = "desktop",
  joinSlot,
  infoSlot,
}: Props) {
  const isMember = myRole !== null;
  const isClubPage = (community.kind ?? groupKind) === "club";
  const cityLabel = [community.address_city, community.address_state].filter(Boolean).join(" – ");
  const slides = communityCoverSlides(community.cover_image_url, community.gallery_images);
  const avatarSrc = community.cover_image_url || slides[0] || null;
  const canManageGallery = myRole === "owner" || myRole === "moderator";

  if (variant === "mobile") {
    return (
      <div className="space-y-3">
        <div className="community-cover-banner relative aspect-[16/7] max-h-40 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-accent)]">
          <CommunityCoverCarousel slides={slides} alt={community.name} />
          {canManageGallery && (
            <button
              type="button"
              onClick={onOpenGalleryManager}
              className="pointer-events-auto absolute bottom-2 left-2 z-[3] rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-black/75"
            >
              Gerenciar fotos
            </button>
          )}
        </div>

        <section className="toq-card-lg p-4">
          <div className="flex gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-accent)] ring-2 ring-[var(--toq-border)]">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold text-[var(--toq-navy)]">{community.name}</h1>
                  <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
                    {groupVisibilityLabel(community.kind ?? groupKind, community.is_private)}
                    {myRole
                      ? ` · ${[memberRoleLabel(myRole), isClubProfessor ? "Professor" : null]
                          .filter(Boolean)
                          .join(" · ")}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isClubPage && isMember && (
                    <ClubFavoriteButton
                      communityId={community.id}
                      favorited={isFavorite}
                      onChange={onFavoriteChange}
                    />
                  )}
                  <ReportButton
                    userId={profileId}
                    target={{
                      type: "community",
                      id: community.id,
                      label: `${groupKind === "club" ? "clube" : "comunidade"} ${community.name}`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[var(--toq-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <MembersIcon />
              {community.member_count.toLocaleString("pt-BR")} / 1.000 membros
            </span>
            {cityLabel ? (
              <span className="inline-flex items-center gap-1">
                <PinIcon />
                {cityLabel}
              </span>
            ) : null}
          </div>

          {community.description?.trim() ? (
            <div className="mt-3">
              <PostBody
                body={community.description}
                maxLines={3}
                className="break-words text-sm leading-relaxed text-[var(--toq-text-muted)]"
              />
            </div>
          ) : null}

          {(isMember || joinSlot) && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {isOwner(myRole) ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-card)] px-3 text-xs font-bold text-[var(--toq-navy)]"
                >
                  Configurações
                </button>
              ) : isMember ? (
                <button
                  type="button"
                  onClick={onLeave}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--toq-border)] px-3 text-xs font-semibold text-[var(--toq-text-muted)]"
                >
                  Sair
                </button>
              ) : (
                <div className="col-span-2">{joinSlot}</div>
              )}
              {isMember && (
                <Link
                  href={`/inicio/mensagens?g=${encodeURIComponent(community.id)}`}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl toq-btn-primary px-3 text-xs font-bold text-white"
                >
                  Chat do grupo
                </Link>
              )}
            </div>
          )}

          {infoSlot ? <div className="mt-4">{infoSlot}</div> : null}
        </section>
      </div>
    );
  }

  // Desktop / default
  return (
    <header className="overflow-hidden toq-card-lg">
      <div className="community-cover-banner relative aspect-[3/1] max-h-56 w-full overflow-hidden bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-accent)]">
        <CommunityCoverCarousel slides={slides} alt={community.name} />
        {canManageGallery && (
          <button
            type="button"
            onClick={onOpenGalleryManager}
            className="pointer-events-auto absolute bottom-2 left-2 z-[3] rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-black/75"
          >
            Gerenciar fotos
          </button>
        )}
      </div>
      <div className="p-4" style={{ borderTopWidth: 3, borderTopColor: community.accent_color }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 w-full sm:flex-1">
            <h1 className="break-words text-xl font-bold text-[var(--toq-navy)]">{community.name}</h1>
            {community.description?.trim() ? (
              <div className="mt-1 min-w-0">
                <PostBody
                  body={community.description}
                  maxLines={3}
                  className="break-words text-sm leading-relaxed text-[var(--toq-text-muted)]"
                />
              </div>
            ) : null}
            <p className="mt-2 break-words text-xs font-semibold text-[var(--toq-accent)]">
              {community.member_count.toLocaleString("pt-BR")} / 1.000 membros ·{" "}
              {groupVisibilityLabel(community.kind ?? groupKind, community.is_private)}
              {myRole &&
                ` · ${[memberRoleLabel(myRole), isClubProfessor ? "Professor" : null]
                  .filter(Boolean)
                  .join(" · ")}`}
              {cityLabel ? ` · ${cityLabel}` : ""}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:max-w-[14rem] sm:justify-end lg:max-w-none">
            {isClubPage && isMember && (
              <ClubFavoriteButton
                communityId={community.id}
                favorited={isFavorite}
                onChange={onFavoriteChange}
              />
            )}
            <ReportButton
              userId={profileId}
              target={{
                type: "community",
                id: community.id,
                label: `${groupKind === "club" ? "clube" : "comunidade"} ${community.name}`,
              }}
            />
            {isMember && (
              <Link
                href={`/inicio/mensagens?g=${encodeURIComponent(community.id)}`}
                className="rounded-lg toq-btn-primary px-3 py-1.5 text-xs font-bold text-white"
              >
                Chat do grupo
              </Link>
            )}
            {isOwner(myRole) && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-lg toq-btn-outline px-3 py-1.5 text-xs font-bold"
              >
                Configurações
              </button>
            )}
            {isMember && myRole !== "owner" && (
              <button
                type="button"
                onClick={onLeave}
                className="rounded-lg border border-[var(--toq-border)] px-3 py-1.5 text-xs font-semibold text-[var(--toq-text-muted)]"
              >
                Sair
              </button>
            )}
          </div>
        </div>
        {infoSlot ? <div className="mt-4">{infoSlot}</div> : null}
        {joinSlot ? <div className="mt-4">{joinSlot}</div> : null}
      </div>
    </header>
  );
}
