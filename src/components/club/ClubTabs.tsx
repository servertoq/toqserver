"use client";

import type { ClubTab } from "@/types/clubFeatures";

const TABS: { id: ClubTab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "shop", label: "Loja" },
  { id: "ranking", label: "Ranking" },
  { id: "courts", label: "Quadras" },
  { id: "tournaments", label: "Torneios" },
];

export function ClubTabs({
  active,
  onChange,
  shopEnabled,
}: {
  active: ClubTab;
  onChange: (tab: ClubTab) => void;
  shopEnabled: boolean;
}) {
  const visible = TABS.filter((t) => t.id !== "shop" || shopEnabled);

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-1">
      {visible.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`shrink-0 px-4 py-3 text-sm font-semibold transition ${
            active === tab.id
              ? "border-b-2 border-[var(--toq-accent)] text-[var(--toq-navy)]"
              : "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
