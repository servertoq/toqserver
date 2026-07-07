"use client";

import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { SearchBar } from "@/components/feed/SearchBar";
import { appContentClass } from "@/lib/layout";

export function SearchPage() {
  return (
    <main className={`${appContentClass} py-6`}>
      <h1 className="mb-4 text-xl font-bold text-[var(--toq-navy)] md:hidden">Buscar jogadores</h1>
      <div className="max-w-md">
        <SearchBar />
      </div>
      <p className="mt-4 text-sm text-[var(--toq-text-muted)]">
        Digite pelo menos 2 caracteres para encontrar jogadores na rede Toq Tennis.
      </p>
    </main>
  );
}
