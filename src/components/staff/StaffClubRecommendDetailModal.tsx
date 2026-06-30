"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clubRecommendationStatusLabel } from "@/lib/staffClubRecommendations";
import type {
  ClubRecommendationStatus,
  ClubRecommendationWithReporter,
} from "@/types/clubRecommendations";

type Props = {
  item: ClubRecommendationWithReporter;
  onClose: () => void;
  onUpdated: () => void;
};

export function StaffClubRecommendDetailModal({ item, onClose, onUpdated }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  async function updateStatus(status: ClubRecommendationStatus) {
    setLoading(true);
    setError(null);

    const { error: updateErr } = await supabase
      .from("club_recommendations")
      .update({ status })
      .eq("id", item.id);

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    onUpdated();
    onClose();
    setLoading(false);
  }

  const closed = item.status === "added" || item.status === "dismissed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Indicação de clube · {clubRecommendationStatusLabel(item.status)}
            </p>
            <h2 className="mt-1 text-base font-bold text-[var(--toq-navy)]">{item.club_name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-sm font-semibold text-[var(--toq-text-muted)]"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
            <p className="font-semibold text-[var(--toq-navy)]">
              Indicado por @{item.reporter?.username ?? "usuário"}
            </p>
            {item.reporter?.email && (
              <p className="mt-0.5 text-[var(--toq-text-muted)]">{item.reporter.email}</p>
            )}
            <p className="mt-1 text-[var(--toq-text-muted)]">
              {new Date(item.created_at).toLocaleString("pt-BR")}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--toq-navy)]">Contato informado</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--toq-navy)]">{item.contact}</p>
          </div>

          {item.notes.trim() && (
            <div>
              <p className="text-xs font-semibold text-[var(--toq-navy)]">Observações</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--toq-navy)]">{item.notes}</p>
            </div>
          )}

          {!closed && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              {item.status === "pending" && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => updateStatus("contacted")}
                  className="w-full rounded-xl border border-[var(--toq-accent)] py-2.5 text-sm font-semibold text-[var(--toq-accent)]"
                >
                  Marcar como contactado
                </button>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => updateStatus("added")}
                className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white"
              >
                Clube adicionado à plataforma
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => updateStatus("dismissed")}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[var(--toq-navy)]"
              >
                Descartar indicação
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
