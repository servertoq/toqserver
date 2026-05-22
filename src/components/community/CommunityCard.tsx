import Link from "next/link";
import { communityVisibilityLabel } from "@/lib/community";
import type { CommunityWithMembership } from "@/lib/community";

export function CommunityCard({ community }: { community: CommunityWithMembership }) {
  const isMember = community.my_role !== null;

  return (
    <Link
      href={`/inicio/comunidade/${community.slug}`}
      className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[var(--toq-sky)]/40 hover:shadow-md"
    >
      <div className="relative h-28 bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-sky)]">
        {community.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={community.cover_image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        <span
          className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase text-white"
        >
          {communityVisibilityLabel(community.is_private)}
        </span>
      </div>
      <div className="p-4" style={{ borderTopWidth: 3, borderTopColor: community.accent_color }}>
        <h3 className="font-bold text-[var(--toq-navy)]">{community.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--toq-text-muted)]">
          {community.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--toq-lime-dark)]">
            {community.member_count.toLocaleString("pt-BR")} / 1.000 membros
          </p>
          {isMember && (
            <span className="rounded-full bg-[var(--toq-lime-light)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--toq-navy)]">
              Membro
            </span>
          )}
          {!isMember && community.pending_request && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Aguardando aprovação
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
