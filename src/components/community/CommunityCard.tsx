import Link from "next/link";
import { groupVisibilityLabel } from "@/lib/community";
import { groupDetailHref } from "@/lib/communityGroup";
import type { CommunityWithMembership } from "@/lib/community";
import { ClubFavoriteButton } from "@/components/club/ClubFavoriteButton";
import { CommunityCoverCarousel } from "./CommunityCoverCarousel";
import { communityCoverSlides } from "@/lib/communityGallery";

function ShopIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9h16l-1.2 10.2A2 2 0 0 1 16.81 21H7.19a2 2 0 0 1-1.99-1.8L4 9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 9V7a4 4 0 0 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  const detailHref = groupDetailHref(kind, community.slug);
  const shopEnabled = kind === "club" && (community.shop_enabled ?? false);
  const shopHref = `${detailHref}?tab=shop`;
  const slides = communityCoverSlides(community.cover_image_url, community.gallery_images);

  return (
    <article className="relative overflow-hidden toq-card-lg transition hover:border-[var(--toq-sky)]/40 hover:shadow-md">
      <Link href={detailHref} className="absolute inset-0 z-0" aria-label={community.name} />

      <div className="community-card-cover relative aspect-[3/1] w-full shrink-0 overflow-hidden bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-accent)]">
        <CommunityCoverCarousel
          slides={slides}
          alt={community.name}
          className="absolute inset-0 z-[1]"
        />
        <span className="pointer-events-none absolute right-3 top-3 z-[2] rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
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

      <div
        className="relative z-[1] bg-[var(--toq-card)] p-4"
        style={{ borderTopWidth: 3, borderTopColor: community.accent_color }}
      >
        <Link href={detailHref} className="relative z-[1] block">
          <h3 className="min-w-0 font-bold text-[var(--toq-navy)]">
            {community.is_favorite && kind === "club" ? (
              <span className="mr-1 text-amber-500" aria-hidden>
                ★
              </span>
            ) : null}
            {community.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--toq-text-muted)]">
            {community.description}
          </p>
        </Link>

        <div className="relative z-[1] mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--toq-accent)]">
            {community.member_count.toLocaleString("pt-BR")} / 1.000 membros
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {shopEnabled && (
              <Link
                href={shopHref}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--toq-accent)]/15 text-[var(--toq-accent)] transition hover:bg-[var(--toq-accent)]/25"
                aria-label={`Loja de ${community.name}`}
                title="Loja do clube"
              >
                <ShopIcon className="h-3.5 w-3.5" />
              </Link>
            )}
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
      </div>
    </article>
  );
}
