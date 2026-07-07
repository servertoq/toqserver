"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parsePollState, type PostPollState } from "@/lib/postPolls";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Props = {
  postId: string;
  isAuthor: boolean;
};

export function PollBlock({ postId, isAuthor }: Props) {
  const supabase = createClient();
  const [state, setState] = useState<PostPollState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const { isSubmitting: voting, guard } = useSingleSubmit();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadErr } = await supabase.rpc("get_post_poll_state", {
      p_post_id: postId,
    });
    if (loadErr) {
      setError(loadErr.message);
      setState(null);
    } else {
      const parsed = parsePollState(data);
      setState(parsed);
      setPending(parsed?.my_option_ids ?? []);
      setError(null);
    }
    setLoading(false);
  }, [postId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitVote(optionIds: string[]) {
    if (voting || optionIds.length === 0) return;

    await guard(async () => {
      setError(null);
      const { error: voteErr } = await supabase.rpc("vote_on_poll", {
        p_post_id: postId,
        p_option_ids: optionIds,
      });
      if (voteErr) {
        setError(voteErr.message || "Não foi possível registrar o voto.");
        return;
      }
      await load();
    });
  }

  function togglePending(optionId: string) {
    if (!state) return;

    if (state.allow_multiple) {
      setPending((current) =>
        current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
      );
      return;
    }

    void submitVote([optionId]);
  }

  if (loading) {
    return <p className="mt-2 text-xs text-[var(--toq-text-muted)]">Carregando enquete…</p>;
  }

  if (!state || state.options.length === 0) return null;

  const totalVotes = state.can_see_results
    ? state.options.reduce((sum, opt) => sum + (opt.vote_count ?? 0), 0)
    : 0;
  const hasVoted = state.my_option_ids.length > 0;

  return (
    <div className="mt-3 space-y-2">
      {state.options.map((option) => {
        const selected = state.allow_multiple
          ? pending.includes(option.id)
          : state.my_option_ids.includes(option.id);
        const count = option.vote_count ?? 0;
        const percent =
          state.can_see_results && totalVotes > 0
            ? Math.round((count / totalVotes) * 100)
            : null;

        return (
          <button
            key={option.id}
            type="button"
            disabled={voting}
            onClick={() => togglePending(option.id)}
            className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-60 ${
              selected
                ? "border-[var(--toq-accent)] bg-[var(--toq-accent-soft)]"
                : "border-[var(--toq-border)] bg-[var(--toq-surface)] hover:border-[var(--toq-accent)]"
            }`}
          >
            {state.can_see_results && percent !== null && (
              <span
                className="absolute inset-y-0 left-0 bg-[var(--toq-accent-soft)]/60"
                style={{ width: `${percent}%` }}
                aria-hidden
              />
            )}
            <span className="relative flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                    state.allow_multiple ? "rounded" : "rounded-full"
                  } ${
                    selected
                      ? "border-[var(--toq-accent)] bg-[var(--toq-accent)] text-white"
                      : "border-[var(--toq-border)] bg-[var(--toq-card)]"
                  }`}
                  aria-hidden
                >
                  {selected ? (
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </span>
                <span className="text-sm font-semibold text-[var(--toq-navy)]">{option.label}</span>
              </span>
              {state.can_see_results && percent !== null && (
                <span className="shrink-0 text-xs font-bold text-[var(--toq-text-muted)]">
                  {percent}% · {count}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {state.allow_multiple && (
        <button
          type="button"
          disabled={voting || pending.length === 0}
          onClick={() => void submitVote(pending)}
          className="rounded-lg toq-btn-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {voting ? "Registrando…" : hasVoted ? "Atualizar voto" : "Votar"}
        </button>
      )}

      <p className="text-[10px] text-[var(--toq-text-muted)]">
        {state.allow_multiple ? "Você pode selecionar mais de uma opção." : "Selecione apenas uma opção."}
        {!state.show_results_to_all && !isAuthor && !state.can_see_results
          ? " Os resultados são visíveis apenas para quem publicou."
          : state.can_see_results && state.total_voters !== null
            ? ` · ${state.total_voters} ${state.total_voters === 1 ? "voto" : "votos"}`
            : isAuthor && !state.show_results_to_all
              ? " Só você vê os resultados desta enquete."
              : null}
      </p>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
