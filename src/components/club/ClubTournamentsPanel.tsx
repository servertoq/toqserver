"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { canModerate } from "@/lib/community";
import { fetchClubTournaments } from "@/lib/tournaments";
import type { CommunityMemberRole } from "@/types/community";
import type { ClubTournament } from "@/types/clubFeatures";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ClubTournamentForm } from "./ClubTournamentForm";

type Props = {
  communityId: string;
  clubName: string;
  buyerUsername: string;
  myRole: CommunityMemberRole | null;
};

export function ClubTournamentsPanel({
  communityId,
  clubName,
  buyerUsername,
  myRole,
}: Props) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("torneio");
  const canManage = canModerate(myRole);
  const isMember = myRole !== null;

  const [tournaments, setTournaments] = useState<ClubTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClubTournament | null | undefined>(undefined);
  const [tournamentToRemove, setTournamentToRemove] = useState<ClubTournament | null>(null);
  const [removingTournament, setRemovingTournament] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const list = await fetchClubTournaments(supabase, communityId);
    if (list.length === 0) {
      const { error: probe } = await supabase.from("club_tournaments").select("id").limit(1);
      if (probe?.message?.includes("does not exist") || probe?.code === "42P01") {
        setError(
          "Execute a migration 026_club_tournaments.sql no Supabase para habilitar torneios."
        );
      }
    }
    setTournaments(list);
    setLoading(false);
  }, [communityId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const el = document.getElementById(`torneio-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[var(--toq-accent)]", "ring-offset-2");
    const t = window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-[var(--toq-accent)]", "ring-offset-2");
    }, 2500);
    return () => window.clearTimeout(t);
  }, [highlightId, loading, tournaments]);

  async function confirmDeactivate() {
    if (!tournamentToRemove) return;
    setRemovingTournament(true);
    await supabase
      .from("club_tournaments")
      .update({ is_active: false })
      .eq("id", tournamentToRemove.id);
    setTournamentToRemove(null);
    setRemovingTournament(false);
    await load();
  }

  if (loading) {
    return <p className="mt-4 text-sm text-[var(--toq-text-muted)]">Carregando torneios…</p>;
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[var(--toq-navy)]">Torneios do clube</h2>
          <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
            Torneios públicos aparecem para todos em{" "}
            <strong className="text-[var(--toq-navy)]">Torneios</strong> no menu principal.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-lg toq-btn-primary px-3 py-1.5 text-xs font-bold text-white"
          >
            + Novo torneio
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
          {error}
        </p>
      )}

      {tournaments.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum torneio cadastrado</p>
          {canManage ? (
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Crie o primeiro torneio com nome, imagem, premiação, regras e WhatsApp para inscrições.
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              O administrador ainda não publicou torneios neste clube.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((t) => (
            <div key={t.id} className="relative">
              <TournamentCard
                tournament={t}
                clubName={clubName}
                username={buyerUsername}
                showClubLink={false}
                canSignup={isMember || !t.is_private}
                canShare={t.is_active}
              />
              {canManage && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-[var(--toq-navy)]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setTournamentToRemove(t)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <ClubTournamentForm
          communityId={communityId}
          tournament={editing}
          onSaved={load}
          onClose={() => setEditing(undefined)}
        />
      )}

      <ConfirmDialog
        open={!!tournamentToRemove}
        title="Remover torneio"
        message={
          tournamentToRemove
            ? `Remover o torneio "${tournamentToRemove.name}" da listagem?`
            : "Remover este torneio?"
        }
        confirmLabel="Remover"
        variant="danger"
        loading={removingTournament}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => {
          if (!removingTournament) setTournamentToRemove(null);
        }}
      />
    </div>
  );
}
