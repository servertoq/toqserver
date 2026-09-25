"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { completeOpenMatch } from "@/lib/openMatches";
import { validateThreeSetInputs } from "@/lib/matchResultSets";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { OpenMatchDetail } from "@/types/openMatches";
import { MatchScoreboardEdit } from "@/components/partidas/MatchScoreboard";

type Props = {
  match: OpenMatchDetail;
  onClose: () => void;
  onDone: () => void;
};

const DEFAULT_SETS = [
  { team1: "", team2: "" },
  { team1: "", team2: "" },
  { team1: "", team2: "" },
];

export function CompleteMatchResultModal({ match, onClose, onDone }: Props) {
  const supabase = createClient();
  const { isSubmitting, guard } = useSingleSubmit();
  const [sets, setSets] = useState(DEFAULT_SETS);
  const [shareScope, setShareScope] = useState<"participants" | "general">("participants");
  const [error, setError] = useState<string | null>(null);

  const confirmed = match.players.filter((p) => p.status === "confirmed");
  const team1 = confirmed.filter((p) => p.team === 1);
  const team2 = confirmed.filter((p) => p.team === 2);

  function updateSet(index: number, side: "team1" | "team2", value: string) {
    setSets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, [side]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = validateThreeSetInputs(sets);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    await guard(async () => {
      const { error: err } = await completeOpenMatch(supabase, match.id, {
        sets: parsed.values.map((s) => ({
          team1: s.team1!,
          team2: s.team2!,
        })),
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
        className="relative z-[1] w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-[var(--toq-card)] sm:max-w-lg sm:rounded-3xl"
      >
        <div className="border-b border-[var(--toq-border)] px-5 py-4">
          <h3 className="text-base font-bold text-[var(--toq-text)]">
            Registrar placar #{match.match_number}
          </h3>
          <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
            Informe a pontuação de cada equipe nos três sets. O placar aparece no feed de quem jogou.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <MatchScoreboardEdit
            team1={team1}
            team2={team2}
            sets={sets}
            onSetChange={updateSet}
          />

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
