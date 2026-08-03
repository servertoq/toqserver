"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapCourtRow } from "@/lib/courts";
import { fetchBrowsableClubCourts } from "@/lib/clubCourtBrowse";
import { matchesLocationSearch, LOCATION_SEARCH_PLACEHOLDER } from "@/lib/locationSearch";
import { partitionByProximity, type PlaceLocation } from "@/lib/nearbyLocation";
import { useUserLocationAnchor } from "@/hooks/useUserLocationAnchor";
import { fetchPlanUsage, canCreateCourtResource } from "@/lib/plans";
import { fetchManagedClubs, fetchManagedCourts, type ManagedClub } from "@/lib/courtManagement";
import { groupDetailHref } from "@/lib/communityGroup";
import { useAppProfile } from "@/components/app/AppShell";
import type { PlanUsage } from "@/types/plans";
import type { CourtWithOwner } from "@/types/courts";
import { appContentClass } from "@/lib/layout";
import { CourtCard } from "./CourtCard";
import { ClubCourtBrowseCard } from "./ClubCourtBrowse";
import type { BrowsableClubCourt } from "@/lib/clubCourtBrowse";
import { PageHeader } from "@/components/shared/PageHeader";
import { NearbySection, OtherSection } from "@/components/shared/NearbySections";

type CourtsFilter = "all" | "my_club";
type ClubAction = "nova" | "agenda";

type CourtListItem =
  | { kind: "club"; id: string; court: BrowsableClubCourt }
  | { kind: "standalone"; id: string; court: CourtWithOwner };

function courtItemPlace(item: CourtListItem): PlaceLocation {
  if (item.kind === "standalone") {
    return {
      latitude: item.court.latitude,
      longitude: item.court.longitude,
      city: item.court.city,
      state: item.court.state,
      cep: item.court.cep,
    };
  }
  return {
    city: item.court.community?.address_city,
    state: item.court.community?.address_state,
    cep: item.court.community?.address_zip,
  };
}

function clubCourtsHref(slug: string, action?: ClubAction) {
  const base = `${groupDetailHref("club", slug)}?tab=courts`;
  return action ? `${base}&action=${action}` : base;
}

export function CourtsPage() {
  const profile = useAppProfile();
  const router = useRouter();
  const supabase = createClient();
  const { anchor } = useUserLocationAnchor(profile.id);
  const [courts, setCourts] = useState<CourtWithOwner[]>([]);
  const [clubCourts, setClubCourts] = useState<BrowsableClubCourt[]>([]);
  const [managedClubs, setManagedClubs] = useState<ManagedClub[]>([]);
  const [hasManagedCourts, setHasManagedCourts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CourtsFilter>("all");
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [clubPicker, setClubPicker] = useState<ClubAction | null>(null);

  const refreshClubCourts = useCallback(async () => {
    const [{ data, error: listErr }, usage, clubRows, clubs, managedCourtRows] = await Promise.all([
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
      profile.canAccessCourtManagement
        ? fetchManagedClubs(supabase, profile.id)
        : Promise.resolve([] as ManagedClub[]),
      profile.canAccessCourtManagement
        ? fetchManagedCourts(supabase, profile.id)
        : Promise.resolve([]),
    ]);
    setPlanUsage(usage);
    setManagedClubs(clubs);
    setHasManagedCourts(managedCourtRows.length > 0);

    if (listErr) {
      setError(
        "Não foi possível carregar quadras. Execute a migration 020_courts.sql no Supabase."
      );
      return;
    }

    setCourts((data ?? []).map((row) => mapCourtRow(row)));
    setClubCourts(clubRows);
  }, [profile.canAccessCourtManagement, profile.id, supabase]);

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

  const myClubCourts = useMemo(
    () => clubCourts.filter((c) => c.is_member_club),
    [clubCourts]
  );

  const filteredCourts = useMemo(() => {
    if (filter === "my_club") return [];
    return courts.filter((c) =>
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
  }, [courts, filter, search]);

  const filteredClubCourts = useMemo(() => {
    const source = filter === "my_club" ? myClubCourts : clubCourts;
    return source.filter((c) =>
      matchesLocationSearch(search, {
        name: c.name,
        description: c.description,
        city: c.community?.address_city,
        cep: c.community?.address_zip,
        neighborhood: c.community?.address_neighborhood,
        street: c.community?.address_street,
        formattedAddress: c.community?.name,
      })
    );
  }, [clubCourts, filter, myClubCourts, search]);

  const listItems = useMemo<CourtListItem[]>(() => {
    const clubItems: CourtListItem[] = filteredClubCourts.map((court) => ({
      kind: "club",
      id: `club-${court.id}`,
      court,
    }));
    const standaloneItems: CourtListItem[] = filteredCourts.map((court) => ({
      kind: "standalone",
      id: court.id,
      court,
    }));
    return [...clubItems, ...standaloneItems];
  }, [filteredClubCourts, filteredCourts]);

  const { nearby, others } = useMemo(
    () => partitionByProximity(listItems, courtItemPlace, anchor),
    [anchor, listItems]
  );

  const totalCount = listItems.length;
  const hasAny =
    filter === "my_club"
      ? myClubCourts.length > 0
      : courts.length + clubCourts.length > 0;

  function renderCourtGrid(items: CourtListItem[]) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            {item.kind === "club" ? (
              <ClubCourtBrowseCard court={item.court} />
            ) : (
              <CourtCard court={item.court} />
            )}
          </li>
        ))}
      </ul>
    );
  }

  const canCreateStandalone = canCreateCourtResource(planUsage, profile.staffRole);
  const hasManagedClubs = managedClubs.length > 0;
  /** Só mostra gestão/agenda quando já existe pelo menos uma quadra no clube. */
  const showManagerActions = profile.canAccessCourtManagement && hasManagedClubs && hasManagedCourts;
  const showCreateClubCourt = profile.canAccessCourtManagement && hasManagedClubs;

  function resolveClubAction(action: ClubAction): string | null {
    if (managedClubs.length === 1) return clubCourtsHref(managedClubs[0].slug, action);
    if (managedClubs.length > 1) {
      setClubPicker(action);
      return null;
    }
    return null;
  }

  const headerAction =
    showManagerActions || showCreateClubCourt || canCreateStandalone ? (
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
        {showManagerActions && (
          <>
            <Link
              href="/inicio/gestao-de-quadras"
              className="inline-flex h-10 w-full items-center justify-center rounded-xl toq-btn-primary px-3 text-center text-xs font-bold leading-tight text-white sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm sm:leading-none"
            >
              Gestão de Quadras
            </Link>
            <button
              type="button"
              onClick={() => {
                const href = resolveClubAction("agenda");
                if (href) router.push(href);
              }}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl toq-btn-outline px-3 text-center text-xs font-bold leading-tight sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm sm:leading-none"
            >
              Gerenciar agenda
            </button>
            <button
              type="button"
              onClick={() => {
                const href = resolveClubAction("nova");
                if (href) router.push(href);
              }}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl toq-btn-primary px-3 text-center text-xs font-bold leading-tight text-white sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm sm:leading-none"
            >
              + Nova quadra
            </button>
            {canCreateStandalone && (
              <Link
                href="/inicio/quadras/cadastrar"
                className="inline-flex h-10 w-full items-center justify-center rounded-xl toq-btn-outline px-3 text-center text-xs font-bold leading-tight sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm sm:leading-none"
              >
                Quadra avulsa
              </Link>
            )}
          </>
        )}
        {!showManagerActions && showCreateClubCourt && (
          <button
            type="button"
            onClick={() => {
              const href = resolveClubAction("nova");
              if (href) router.push(href);
            }}
            className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-xl toq-btn-primary px-4 text-sm font-bold text-white sm:col-span-1 sm:h-9 sm:w-auto"
          >
            + Nova quadra
          </button>
        )}
        {!showManagerActions && !showCreateClubCourt && canCreateStandalone && (
          <Link
            href="/inicio/quadras/cadastrar"
            className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-xl toq-btn-primary px-4 text-sm font-bold text-white sm:col-span-1 sm:h-9 sm:w-auto"
          >
            Cadastrar quadra
          </Link>
        )}
      </div>
    ) : undefined;

  return (
    <>
      <main className={appContentClass}>
        <PageHeader
          kicker=""
          title="Quadras"
          subtitle="Encontre a melhor quadra perto de você e agende para treinos, jogos ou torneios!"
          action={headerAction}
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filter === "all"
                ? "bg-[var(--toq-accent)] text-white"
                : "border border-[var(--toq-border)] bg-[var(--toq-card)] text-[var(--toq-navy)] hover:border-[var(--toq-accent)]"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setFilter("my_club")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filter === "my_club"
                ? "bg-[var(--toq-accent)] text-white"
                : "border border-[var(--toq-border)] bg-[var(--toq-card)] text-[var(--toq-navy)] hover:border-[var(--toq-accent)]"
            }`}
          >
            Do meu clube
          </button>
        </div>

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
          <div className="rounded-2xl border border-dashed border-[var(--toq-border)] bg-[var(--toq-card)] p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">
              {!hasAny
                ? filter === "my_club"
                  ? "Nenhuma quadra nos seus clubes"
                  : "Nenhuma quadra cadastrada ainda"
                : "Nenhum resultado na busca"}
            </p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              {filter === "my_club"
                ? "Entre em um clube ou peça ao administrador para cadastrar quadras."
                : "Seja o primeiro a cadastrar uma quadra na sua região."}
            </p>
          </div>
        ) : nearby.length > 0 ? (
          <div className="space-y-8">
            <NearbySection title="Quadras perto de mim" anchor={anchor}>
              {renderCourtGrid(nearby)}
            </NearbySection>
            {others.length > 0 && (
              <OtherSection title="Outras quadras">{renderCourtGrid(others)}</OtherSection>
            )}
          </div>
        ) : (
          renderCourtGrid(listItems)
        )}
      </main>

      {clubPicker && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="club-picker-title"
          onClick={() => setClubPicker(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="club-picker-title" className="text-lg font-bold text-[var(--toq-navy)]">
              {clubPicker === "nova" ? "Cadastrar quadra em qual clube?" : "Gerenciar agenda de qual clube?"}
            </h2>
            <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
              Escolha o clube para continuar com planos, preços e agenda.
            </p>
            <ul className="mt-4 space-y-2">
              {managedClubs.map((club) => (
                <li key={club.id}>
                  <Link
                    href={clubCourtsHref(club.slug, clubPicker)}
                    className="block rounded-xl border border-[var(--toq-border)] px-4 py-3 text-sm font-semibold text-[var(--toq-navy)] transition hover:border-[var(--toq-accent)]"
                    onClick={() => setClubPicker(null)}
                  >
                    {club.name}
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setClubPicker(null)}
              className="mt-4 w-full rounded-lg border border-[var(--toq-border)] px-4 py-2.5 text-sm font-semibold text-[var(--toq-text-muted)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
