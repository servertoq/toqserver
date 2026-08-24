"use client";

import type { ReactNode } from "react";
import type { ClubTab } from "@/types/clubFeatures";

const TABS: { id: ClubTab; label: string; icon: (active: boolean) => ReactNode }[] = [
  {
    id: "feed",
    label: "Feed",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    id: "shop",
    label: "Loja",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 8h12l-1 12H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2"
        />
      </svg>
    ),
  },
  {
    id: "tournaments",
    label: "Torneios",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 4h8v5a4 4 0 0 1-8 0V4Zm-3 1h3m10 0h3M5 5v2a4 4 0 0 0 3.2 3.9M19 5v2a4 4 0 0 1-3.2 3.9M12 13v3m0 0h3m-3 0H9m3 3v2"
        />
      </svg>
    ),
  },
  {
    id: "courts",
    label: "Quadras",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75} aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path strokeLinecap="round" d="M12 5v14M3 12h18" />
      </svg>
    ),
  },
  {
    id: "ranking",
    label: "Ranking",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m6 10V4m6 16v-7m6 7V8" />
      </svg>
    ),
  },
  {
    id: "gallery",
    label: "Galeria",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75} aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 16-5.5-5.5L7 19" />
      </svg>
    ),
  },
];

export function ClubTabs({
  active,
  onChange,
  shopEnabled,
  guestShopOnly = false,
}: {
  active: ClubTab;
  onChange: (tab: ClubTab) => void;
  shopEnabled: boolean;
  /** Visitantes: só a aba Loja (compra sem ser membro). */
  guestShopOnly?: boolean;
}) {
  const visible = guestShopOnly
    ? TABS.filter((t) => t.id === "shop" && shopEnabled)
    : TABS.filter((t) => t.id !== "shop" || shopEnabled);

  return (
    <div className="club-tabs-bar" role="tablist" aria-label="Seções do clube">
      {visible.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`club-tabs-item ${isActive ? "club-tabs-item--active" : ""}`}
          >
            <span className="club-tabs-item-icon">{tab.icon(isActive)}</span>
            <span className="club-tabs-item-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
