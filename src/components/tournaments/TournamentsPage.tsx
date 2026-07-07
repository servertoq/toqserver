"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { fetchAllTournaments } from "@/lib/tournaments";
import type { ClubTournament } from "@/types/clubFeatures";
import { appContentClass } from "@/lib/layout";
import { TournamentCard } from "./TournamentCard";
import { PageHeader } from "@/components/shared/PageHeader";

export function TournamentsPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const [tournaments, setTournaments] = useState<ClubTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const list = await fetchAllTournaments(supabase);
    if (list.length === 0) {
      const { error: probe } = await supabase.from("club_tournaments").select("id").limit(1);
      if (probe?.message?.includes("does not exist") || probe?.code === "42P01") {
        setError(
          "Não foi possível carregar torneios. Execute a migration 026_club_tournaments.sql no Supabase."
        );
      }
    }
    setTournaments(list);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = tournaments.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const club = t.community?.name?.toLowerCase() ?? "";
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      club.includes(q) ||
      t.prizes.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <main className={appContentClass}>
        <PageHeader
          kicker=""
          title="Torneios"
          subtitle="Torneios cadastrados pelos clubes. Inscreva-se pelo WhatsApp do organizador."
        />

        <input
          type="search"
          placeholder="Buscar por torneio, clube ou premiação…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="toq-input mb-6 w-full px-4 py-2.5 text-sm"
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando torneios…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">
              {tournaments.length === 0
                ? "Nenhum torneio disponível no momento"
                : "Nenhum resultado na busca"}
            </p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Os clubes publicam torneios na aba Torneios do perfil do clube.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                clubName={t.community?.name ?? "Clube"}
                username={profile.username}
                canSignup
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
