import Link from "next/link";
import { formatCourtAddress } from "@/lib/courts";
import type { CourtWithOwner } from "@/types/courts";

export function CourtCard({ court }: { court: CourtWithOwner }) {
  return (
    <Link
      href={`/inicio/quadras/${court.id}`}
      className="block overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--toq-sky)]/40 hover:shadow-md"
    >
      <h3 className="font-bold text-[var(--toq-navy)]">{court.name}</h3>
      <p className="mt-1 text-xs font-semibold text-[var(--toq-lime-dark)]">{court.size_label}</p>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--toq-text-muted)]">{court.description}</p>
      <p className="mt-3 text-xs text-[var(--toq-text-muted)]">{formatCourtAddress(court)}</p>
      {court.owner && (
        <p className="mt-2 text-[11px] text-[var(--toq-text-muted)]">Por @{court.owner.username}</p>
      )}
    </Link>
  );
}
