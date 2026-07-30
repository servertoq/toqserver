import Link from "next/link";
import { groupVisibilityLabel } from "@/lib/community";
import { groupDetailHref } from "@/lib/communityGroup";
import type { CommunityWithMembership } from "@/lib/community";
import { ClubFavoriteButton } from "@/components/club/ClubFavoriteButton";

export function CommunityCard({
  community,
  onFavoriteChange,
}: {
  community: CommunityWithMembership;
  onFavoriteChange?: (communityId: string, favorited: boolean) => void;
}) {
  const isMember = community.my_role !== null;
  const kind = community.kind ?? "community";
  const canFavorite = kind === "club" && isMember;

  return (
    <Link
      href={groupDetailHref(kind, community.slug)}
      className="relative block overflow-hidden toq-card-lg transition hover:border-[var(--toq-sky)]/40 hover:shadow-md"
    >
      <div className="community-card-cover relative aspect-[3/1] w-full shrink-0 overflow-hidden bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-accent)]">
        {community.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={community.cover_image_url}
            alt=""
            className="community-cover-img h-full w-full object-cover"
          />
        ) : null}
        <span
          className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase text-white"
        >
          {groupVisibilityLabel(kind, community.is_private)}
        </span>
        {canFavorite && (
          <div className="absolute left-3 top-3 z-10">
            <ClubFavoriteButton
              communityId={community.id}
              favorited={community.is_favorite}
              onChange={(fav) => onFavoriteChange?.(community.id, fav)}
            />
          </div>
        )}
      </div>
      <div className="relative z-[1] bg-[var(--toq-card)] p-4" style={{ borderTopWidth: 3, borderTopColor: community.accent_color }}>
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-bold text-[var(--toq-navy)]">
            {community.is_favorite && kind === "club" ? (
              <span className="mr-1 text-amber-500" aria-hidden>
                ★
              </span>
            ) : null}
            {community.name}
          </h3>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--toq-text-muted)]">
          {community.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--toq-accent)]">
            {community.member_count.toLocaleString("pt-BR")} / 1.000 membros
          </p>
          {isMember && (
            <span className="rounded-full bg-[var(--toq-accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--toq-accent)]">
              Membro
            </span>
          )}
          {!isMember && community.pending_invite && (
            <span className="rounded-full bg-[var(--toq-accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--toq-accent)]">
              Convite pendente
            </span>
          )}
          {!isMember && !community.pending_invite && community.pending_request && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              Aguardando aprovação
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
