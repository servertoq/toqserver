"use client";

import { SearchBar } from "./SearchBar";

type Props = {
  username: string;
  onLogout: () => void;
};

export function FeedHeader({ username, onLogout }: Props) {
  return (
    <header className="sticky top-0 z-30 toq-topbar backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3 md:max-w-3xl md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div
            className="h-8 w-20 shrink-0 toq-btn-primary bg-[var(--toq-accent)] md:h-9 md:w-24"
            style={{
              maskImage: "url(/imagens_publicas/logo_transp.png)",
              WebkitMaskImage: "url(/imagens_publicas/logo_transp.png)",
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "left center",
              WebkitMaskPosition: "left center",
            }}
            role="img"
            aria-label="Toq Tennis"
          />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-semibold text-[var(--toq-navy)] sm:inline">
              @{username}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[var(--toq-text-muted)] transition hover:border-[var(--toq-accent)] hover:text-[var(--toq-navy)]"
            >
              Sair
            </button>
          </div>
        </div>
        <SearchBar />
      </div>
    </header>
  );
}
