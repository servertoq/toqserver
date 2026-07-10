"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapCourtRow } from "@/lib/courts";
import { fetchBrowsableClubCourts } from "@/lib/clubCourtBrowse";
import { matchesLocationSearch, LOCATION_SEARCH_PLACEHOLDER } from "@/lib/locationSearch";
import { fetchPlanUsage, canCreateCourtResource } from "@/lib/plans";
import { useAppProfile } from "@/components/app/AppShell";
import type { PlanUsage } from "@/types/plans";
import type { CourtWithOwner } from "@/types/courts";
import { appContentClass } from "@/lib/layout";
import { CourtCard } from "./CourtCard";
import { ClubCourtBrowseCard } from "./ClubCourtBrowse";
import type { BrowsableClubCourt } from "@/lib/clubCourtBrowse";
import { PageHeader } from "@/components/shared/PageHeader";

export function CourtsPage() {
  const profile = useAppProfile();
  const supabase = createClient();
  const [courts, setCourts] = useState<CourtWithOwner[]>([]);
  const [clubCourts, setClubCourts] = useState<BrowsableClubCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);

  const refreshClubCourts = useCallback(async () => {
    const [{ data, error: listErr }, usage, clubRows] = await Promise.all([
      supabase
        .from("courts")
        .select(
          `
        *,
        owner:profiles!courts_owner_id_fkey(id, username, avatar_url)
      `
        )
        .order("created_at", { ascending: false }),
      fetchPlanUsage(supabase),
      fetchBrowsableClubCourts(supabase, profile.id),
    ]);
    setPlanUsage(usage);

    if (listErr) {
      setError(
        "Não foi possível carregar quadras. Execute a migration 020_courts.sql no Supabase."
      );
      return;
    }

    setCourts((data ?? []).map((row) => mapCourtRow(row)));
    setClubCourts(clubRows);
  }, [profile.id, supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshClubCourts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar quadras.");
    } finally {
      setLoading(false);
    }
  }, [refreshClubCourts]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("quadras-menu-availability")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_court_blocks" },
        () => {
          void refreshClubCourts();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_court_bookings" },
        () => {
          void refreshClubCourts();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "club_courts" },
        () => {
          void refreshClubCourts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshClubCourts, supabase]);

  const filteredCourts = courts.filter((c) =>
    matchesLocationSearch(search, {
      name: c.name,
      city: c.city,
      cep: c.cep,
      neighborhood: c.neighborhood,
      street: c.street,
      description: c.description,
      formattedAddress: c.formatted_address,
    })
  );

  const q = search.trim().toLowerCase();
  const filteredClubCourts = clubCourts.filter((c) => {
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      (c.community?.name ?? "").toLowerCase().includes(q)
    );
  });

  const totalCount = filteredCourts.length + filteredClubCourts.length;
  const hasAny = courts.length + clubCourts.length > 0;

  return (
    <>
      <main className={appContentClass}>
        <PageHeader
          kicker=""
          title="Quadras"
          subtitle="Encontre a melhor quadra perto de você e agende para treinos, jogos ou torneios!"
          action={
            canCreateCourtResource(planUsage, profile.staffRole) ? (
              <Link
                href="/inicio/quadras/cadastrar"
                className="toq-btn-primary rounded-xl px-4 py-2 text-sm text-white"
              >
                Cadastrar quadra
              </Link>
            ) : undefined
          }
        />

        <input
          type="search"
          placeholder={LOCATION_SEARCH_PLACEHOLDER}
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
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
        ) : totalCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">
              {!hasAny ? "Nenhuma quadra cadastrada ainda" : "Nenhum resultado na busca"}
            </p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Seja o primeiro a cadastrar uma quadra na sua região.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredClubCourts.map((c) => (
              <li key={`club-${c.id}`}>
                <ClubCourtBrowseCard court={c} />
              </li>
            ))}
            {filteredCourts.map((c) => (
              <li key={c.id}>
                <CourtCard court={c} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
