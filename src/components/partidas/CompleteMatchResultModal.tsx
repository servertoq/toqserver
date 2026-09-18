"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { completeOpenMatch } from "@/lib/openMatches";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { OpenMatchDetail } from "@/types/openMatches";

type Props = {
  match: OpenMatchDetail;
  onClose: () => void;
  onDone: () => void;
};

export function CompleteMatchResultModal({ match, onClose, onDone }: Props) {
  const supabase = createClient();
  const { isSubmitting, guard } = useSingleSubmit();
  const [team1Score, setTeam1Score] = useState("6");
  const [team2Score, setTeam2Score] = useState("4");
  const [shareScope, setShareScope] = useState<"participants" | "general">("participants");
  const [error, setError] = useState<string | null>(null);

  const confirmed = match.players.filter((p) => p.status === "confirmed");
  const team1 = confirmed.filter((p) => p.team === 1);
  const team2 = confirmed.filter((p) => p.team === 2);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const s1 = Number(team1Score);
    const s2 = Number(team2Score);
    if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 < 0 || s2 < 0) {
      setError("Informe placares válidos (números inteiros).");
      return;
    }

    await guard(async () => {
      const { error: err } = await completeOpenMatch(supabase, match.id, {
        team1Score: s1,
        team2Score: s2,
        shareScope,
      });
      if (err) {
        setError(err);
        return;
      }
      onDone();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-[1] w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-[var(--toq-card)] sm:rounded-3xl"
      >
        <div className="border-b border-[var(--toq-border)] px-5 py-4">
          <h3 className="text-base font-bold text-[var(--toq-text)]">
            Registrar placar #{match.match_number}
          </h3>
          <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
            O resultado aparece no feed de quem jogou.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="block text-center">
              <span className="text-[11px] font-semibold text-[var(--toq-text-muted)]">
                Time 1
              </span>
              <p className="mt-1 truncate text-xs text-[var(--toq-text)]">
                {team1.map((p) => `@${p.username}`).join(" + ") || "—"}
              </p>
              <input
                inputMode="numeric"
                value={team1Score}
                onChange={(e) => setTeam1Score(e.target.value.replace(/\D/g, "").slice(0, 2))}
                className="mt-2 w-full rounded-xl toq-input px-3 py-3 text-center text-2xl font-bold text-[var(--toq-text)]"
              />
            </label>
            <span className="pb-3 text-lg font-bold text-[var(--toq-text-muted)]">—</span>
            <label className="block text-center">
              <span className="text-[11px] font-semibold text-[var(--toq-text-muted)]">
                Time 2
              </span>
              <p className="mt-1 truncate text-xs text-[var(--toq-text)]">
                {team2.map((p) => `@${p.username}`).join(" + ") || "—"}
              </p>
              <input
                inputMode="numeric"
                value={team2Score}
                onChange={(e) => setTeam2Score(e.target.value.replace(/\D/g, "").slice(0, 2))}
                className="mt-2 w-full rounded-xl toq-input px-3 py-3 text-center text-2xl font-bold text-[var(--toq-text)]"
              />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Publicação
            </legend>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--toq-border)] px-3 py-2.5">
              <input
                type="radio"
                name="share"
                checked={shareScope === "participants"}
                onChange={() => setShareScope("participants")}
                className="mt-1 accent-[var(--toq-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--toq-text)]">
                  Privado (só jogadores)
                </span>
                <span className="text-[11px] text-[var(--toq-text-muted)]">
                  Aparece só para quem participou. Cada um pode mudar depois no perfil.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--toq-border)] px-3 py-2.5">
              <input
                type="radio"
                name="share"
                checked={shareScope === "general"}
                onChange={() => setShareScope("general")}
                className="mt-1 accent-[var(--toq-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--toq-text)]">
                  Público / geral
                </span>
                <span className="text-[11px] text-[var(--toq-text-muted)]">
                  {match.community_id
                    ? "Vai para o feed do clube e para o feed geral."
                    : "Vai para o feed geral de todos."}
                </span>
              </span>
            </label>
          </fieldset>
        </div>

        <div className="flex gap-2 border-t border-[var(--toq-border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--toq-border)] py-2.5 text-sm font-semibold text-[var(--toq-text)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-[var(--toq-accent)] py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Publicando…" : "Publicar resultado"}
          </button>
        </div>
      </form>
    </div>
  );
}
