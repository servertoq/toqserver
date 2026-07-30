"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ClubTournamentForm } from "@/components/club/ClubTournamentForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { appContentClass } from "@/lib/layout";
import {
  deleteTournament,
  fetchMyStandaloneTournaments,
  formatTournamentDateRange,
  setTournamentActive,
  tournamentLocationLabel,
} from "@/lib/tournaments";
import type { ClubTournament } from "@/types/clubFeatures";

export function PromoterManagementPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const [tournaments, setTournaments] = useState<ClubTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClubTournament | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClubTournament | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await fetchMyStandaloneTournaments(supabase, profile.id);
      setTournaments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar torneios.");
    } finally {
      setLoading(false);
    }
  }, [profile.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(tournament: ClubTournament) {
    const next = !tournament.is_active;
    const { error: err } = await setTournamentActive(supabase, tournament.id, next);
    if (err) {
      setError(err);
      return;
    }
    setMessage(next ? "Torneio publicado na aba Torneios." : "Torneio desativado.");
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: err } = await deleteTournament(supabase, deleteTarget.id);
    setDeleting(false);
    if (err) {
      setError(err);
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    setMessage("Torneio excluído.");
    await load();
  }

  return (
    <>
      <main className={appContentClass}>
        <PageHeader
          kicker="Promotor"
          title="Gestão de Torneios"
          subtitle="Crie e gerencie torneios avulsos. Eles aparecem na aba Torneios para toda a plataforma."
          action={
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="toq-btn-primary rounded-xl px-4 py-2 text-sm text-white"
            >
              Novo torneio
            </button>
          }
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800" role="status">
            {message}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando torneios…</p>
        ) : tournaments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhum torneio avulso ainda</p>
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              Crie seu primeiro torneio para divulgar na plataforma.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="mt-4 inline-block rounded-xl toq-btn-primary px-5 py-2.5 text-sm font-bold text-white"
            >
              Criar torneio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => {
              const dateRange = formatTournamentDateRange(t.starts_at, t.ends_at);
              const location = tournamentLocationLabel(t);
              return (
                <article
                  key={t.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-[var(--toq-navy)]">{t.name}</h3>
                      {location && (
                        <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">{location}</p>
                      )}
                      {dateRange && (
                        <p className="mt-1 text-xs font-semibold text-[var(--toq-accent)]">{dateRange}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        t.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {t.is_active ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--toq-text-muted)]">{t.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(t);
                        setFormOpen(true);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[var(--toq-navy)] hover:border-[var(--toq-accent)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(t)}
                      className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
                    >
                      {t.is_active ? "Desativar" : "Publicar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(t)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {formOpen && (
        <ClubTournamentForm
          communityId={null}
          tournament={editing}
          onSaved={() => {
            setMessage(editing ? "Torneio atualizado." : "Torneio criado.");
            void load();
          }}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir torneio?"
        message="Esta ação remove o torneio da plataforma. Não é possível desfazer."
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </>
  );
}
