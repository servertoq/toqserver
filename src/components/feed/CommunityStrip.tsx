import type { FeedCommunity } from "@/types/feed";

export function CommunityStrip({ communities }: { communities: FeedCommunity[] }) {
  if (communities.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-bold text-[var(--toq-navy)]">Comunidades</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {communities.map((c) => (
          <article
            key={c.id}
            className="w-[min(260px,78vw)] shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            style={{ borderTopWidth: 3, borderTopColor: c.accent_color }}
          >
            <h3 className="font-bold text-[var(--toq-navy)]">{c.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--toq-text-muted)]">
              {c.description}
            </p>
            <p className="mt-3 text-xs font-semibold text-[var(--toq-lime-dark)]">
              {c.member_count.toLocaleString("pt-BR")} membros
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
