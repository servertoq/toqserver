"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteCoachListing, fetchCoachListings, fetchMyCoachListing } from "@/lib/coachListings";
import { fetchPlanUsage } from "@/lib/plans";
import type { PlanUsage } from "@/types/plans";
import type { CoachListingWithProfile } from "@/types/coachListings";
import { appContentClass } from "@/lib/layout";
import { CoachListingCard } from "./CoachListingCard";
import { PageHeader } from "@/components/shared/PageHeader";

export function CoachListingsPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const [listings, setListings] = useState<CoachListingWithProfile[]>([]);
  const [myListing, setMyListing] = useState<CoachListingWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CoachListingWithProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [list, mine, usage] = await Promise.all([
        fetchCoachListings(supabase),
        fetchMyCoachListing(supabase, profile.id),
        fetchPlanUsage(supabase),
      ]);
      setListings(list);
      setMyListing(mine);
      setPlanUsage(usage);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar.";
      if (msg.includes("coach_listings") || msg.includes("does not exist")) {
        setError("Execute a migration 034_coach_listings.sql no Supabase.");
      } else {
        setError(msg);
      }
    }
    setLoading(false);
  }, [profile.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = listings.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const user = item.profile?.username?.toLowerCase() ?? "";
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.price_label.toLowerCase().includes(q) ||
      user.includes(q)
    );
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: deleteErr } = await deleteCoachListing(
      supabase,
      deleteTarget,
      profile.id
    );
    setDeleting(false);
    if (deleteErr) {
      setError(deleteErr);
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    await load();
  }

  const createHref = myListing
    ? `/inicio/aprenda-a-jogar/${myListing.id}/editar`
    : "/inicio/aprenda-a-jogar/cadastrar";

  const canAdvertise = myListing !== null || (planUsage?.can_create_coach_listing ?? false);
  const createLabel = myListing ? "Editar minha divulgação" : "Divulgar aulas";

  return (
    <>
      <main className={appContentClass}>
        <PageHeader
          kicker=""
          title="Aprenda à Jogar"
          subtitle="Encontre professores de tênis ou divulgue suas aulas para a comunidade."
          action={
            canAdvertise ? (
              <Link href={createHref} className="toq-btn-primary rounded-xl px-4 py-2 text-sm text-white">
                {createLabel}
              </Link>
            ) : undefined
          }
        />

        <input
          type="search"
          placeholder="Buscar por professor, título ou valor…"
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
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando professores…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">
              {listings.length === 0
                ? "Nenhum professor cadastrado ainda"
                : "Nenhum resultado na busca"}
            </p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Seja o primeiro a divulgar aulas de tênis na plataforma.
            </p>
            {!myListing && (
              <Link
                href="/inicio/aprenda-a-jogar/cadastrar"
                className="mt-4 inline-block rounded-xl toq-btn-primary px-5 py-2.5 text-sm font-bold text-white"
              >
                Divulgar aulas
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <CoachListingCard
                key={item.id}
                listing={item}
                currentUserId={profile.id}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir divulgação?"
        message="Sua publicação será removida desta seção e também do feed."
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </>
  );
}
