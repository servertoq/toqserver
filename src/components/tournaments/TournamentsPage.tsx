"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { fetchAllTournaments, tournamentLocationLabel, tournamentOrganizerLabel } from "@/lib/tournaments";
import { matchesLocationSearch, LOCATION_SEARCH_PLACEHOLDER } from "@/lib/locationSearch";
import { partitionByProximity } from "@/lib/nearbyLocation";
import { useUserLocationAnchor } from "@/hooks/useUserLocationAnchor";
import type { ClubTournament } from "@/types/clubFeatures";
import { appContentClass } from "@/lib/layout";
import { TournamentCard } from "./TournamentCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { NearbySection, OtherSection } from "@/components/shared/NearbySections";
import { isPromotorPlan } from "@/lib/plans";
import { canModeratePlatform } from "@/lib/staff";
import Link from "next/link";

export function TournamentsPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("torneio");
  const { anchor } = useUserLocationAnchor(profile.id);
  const [tournaments, setTournaments] = useState<ClubTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const canManagePromoter =
    isPromotorPlan(profile.plan) || canModeratePlatform(profile.staffRole);

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

  useEffect(() => {
    if (!highlightId || loading) return;
    const el = document.getElementById(`torneio-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, loading, tournaments]);

  const filtered = useMemo(
    () =>
      tournaments.filter((t) =>
        matchesLocationSearch(search, {
          name: t.name,
          description: `${t.description}\n${t.prizes}\n${tournamentOrganizerLabel(t)}`,
          city: t.location_label ?? t.community?.address_city,
          cep: t.community?.address_zip,
          neighborhood: t.community?.address_neighborhood,
          street: t.community?.address_street,
        })
      ),
    [search, tournaments]
  );

  const { nearby, others } = useMemo(
    () =>
      partitionByProximity(
        filtered,
        (t) => {
          const loc = tournamentLocationLabel(t);
          return {
            city: t.community?.address_city ?? loc,
            state: t.community?.address_state,
            cep: t.community?.address_zip,
          };
        },
        anchor
      ),
    [anchor, filtered]
  );

  function renderGrid(items: ClubTournament[]) {
    return (
      <div className="tournament-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((t) => (
          <TournamentCard
            key={t.id}
            tournament={t}
            clubName={tournamentOrganizerLabel(t)}
            username={profile.username}
            canSignup
            canShare={t.is_active}
            showClubLink={Boolean(t.community_id)}
            autoOpenDetail={highlightId === t.id}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <main className={appContentClass}>
        <PageHeader
          kicker=""
          title="Torneios"
          subtitle="Torneios de clubes e de promotores. Busque por nome, cidade ou CEP e compartilhe no chat."
          action={
            canManagePromoter ? (
              <Link
                href="/inicio/gestao-de-torneios"
                className="toq-btn-primary rounded-xl px-4 py-2 text-sm text-white"
              >
                Gestão de Torneios
              </Link>
            ) : undefined
          }
        />

        <input
          type="search"
          placeholder={LOCATION_SEARCH_PLACEHOLDER}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="toq-input mb-4 w-full px-4 py-2 text-sm"
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
        ) : nearby.length > 0 ? (
          <div className="space-y-8">
            <NearbySection title="Torneios perto de mim" anchor={anchor}>
              {renderGrid(nearby)}
            </NearbySection>
            {others.length > 0 && (
              <OtherSection title="Outros torneios">{renderGrid(others)}</OtherSection>
            )}
          </div>
        ) : (
          renderGrid(filtered)
        )}
      </main>
    </>
  );
}
