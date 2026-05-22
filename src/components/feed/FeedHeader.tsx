"use client";

import { SearchBar } from "./SearchBar";

type Props = {
  username: string;
  onLogout: () => void;
};

export function FeedHeader({ username, onLogout }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3 md:max-w-3xl md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div
            className="h-8 w-20 shrink-0 bg-[var(--toq-lime-light)] md:h-9 md:w-24"
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
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[var(--toq-text-muted)] transition hover:border-[var(--toq-lime-light)] hover:text-[var(--toq-navy)]"
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
