"use client";

import {
  clubRecommendationStatusLabel,
  isClubRecommendationOpen,
} from "@/lib/staffClubRecommendations";
import type { ClubRecommendationWithReporter } from "@/types/clubRecommendations";

type Props = {
  recommendations: ClubRecommendationWithReporter[];
  onSelect: (item: ClubRecommendationWithReporter) => void;
  emptyLabel: string;
};

export function StaffClubRecommendBox({ recommendations, onSelect, emptyLabel }: Props) {
  const openCount = recommendations.filter((r) => isClubRecommendationOpen(r.status)).length;

  return (
    <section className="flex min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            🎾
          </span>
          <h2 className="text-sm font-bold text-[var(--toq-navy)]">Indicações de clubes</h2>
        </div>
        {openCount > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {openCount}
          </span>
        )}
      </header>

      <ul className="flex-1 overflow-y-auto p-2">
        {recommendations.length === 0 ? (
          <li className="px-2 py-8 text-center text-xs text-[var(--toq-text-muted)]">{emptyLabel}</li>
        ) : (
          recommendations.map((item) => (
            <li key={item.id} className="mb-2 last:mb-0">
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition hover:border-[var(--toq-accent)] ${
                  isClubRecommendationOpen(item.status)
                    ? "border-slate-200 bg-white"
                    : "border-slate-100 bg-slate-50 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-[var(--toq-navy)]">
                    {item.club_name}
                  </p>
                  <span className="shrink-0 text-[10px] font-semibold text-[var(--toq-text-muted)]">
                    {clubRecommendationStatusLabel(item.status)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-[var(--toq-text-muted)]">{item.contact}</p>
                {item.notes.trim() && (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--toq-text-muted)]">{item.notes}</p>
                )}
                <p className="mt-1.5 text-[10px] font-medium text-[var(--toq-accent)]">
                  @{item.reporter?.username ?? "usuário"} ·{" "}
                  {new Date(item.created_at).toLocaleDateString("pt-BR")}
                </p>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
