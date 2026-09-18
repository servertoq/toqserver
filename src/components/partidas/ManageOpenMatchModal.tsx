"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAddressByCep,
  formatCepDisplay,
  formatProfileLocation,
  normalizeCep,
} from "@/lib/address";
import {
  cancelOpenMatch,
  inviteToOpenMatch,
  kickOpenMatchPlayer,
  respondOpenMatchJoin,
  searchProfilesForOpenMatch,
  updateOpenMatch,
  type OpenMatchProfileSearchResult,
} from "@/lib/openMatches";
import { profileDisplayName } from "@/lib/profile";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { OpenMatchDetail } from "@/types/openMatches";
import { CompleteMatchResultModal } from "./CompleteMatchResultModal";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type Props = {
  match: OpenMatchDetail;
  onClose: () => void;
  onChanged: () => void;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManageOpenMatchModal({ match, onClose, onChanged }: Props) {
  const supabase = createClient();
  const { isSubmitting, guard } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [courtName, setCourtName] = useState(match.court_name);
  const [cep, setCep] = useState("");
  const [city, setCity] = useState(match.city);
  const [stateUf, setStateUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const lastFetchedCep = useRef<string | null>(null);
  const [startsAt, setStartsAt] = useState(toLocalInputValue(match.starts_at));
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<OpenMatchProfileSearchResult[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);

  useEffect(() => {
    setCourtName(match.court_name);
    setCity(match.city);
    setStateUf("");
    setCep("");
    setCepError(null);
    lastFetchedCep.current = null;
    setStartsAt(toLocalInputValue(match.starts_at));
    setConfirmDelete(false);
    setError(null);
    setInviteQuery("");
    setInviteResults([]);
    setInviteMessage(null);
  }, [match]);

  useEffect(() => {
    const q = inviteQuery.trim().replace(/^@/, "");
    if (q.length < 2) {
      setInviteResults([]);
      setInviteSearching(false);
      return;
    }
    let cancelled = false;
    setInviteSearching(true);
    const t = window.setTimeout(() => {
      void (async () => {
        const { items } = await searchProfilesForOpenMatch(supabase, q, 8);
        if (cancelled) return;
        const taken = new Set(match.players.map((p) => p.user_id));
        setInviteResults(items.filter((u) => !taken.has(u.id)));
        setInviteSearching(false);
      })();
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [inviteQuery, match.players, supabase]);

  const pending = match.players.filter((p) => p.status === "pending");
  const invited = match.players.filter((p) => p.status === "invited");
  const confirmed = match.players.filter((p) => p.status === "confirmed");
  const locationLabel =
    formatProfileLocation({ zip: cep, city, state: stateUf }) || city || null;

  async function lookupCep(raw: string) {
    const digits = normalizeCep(raw);
    if (digits.length !== 8) {
      setCepError(digits.length > 0 ? "CEP deve ter 8 dígitos." : null);
      return;
    }
    if (cepLoading || lastFetchedCep.current === digits) return;

    setCepError(null);
    setCepLoading(true);
    try {
      const found = await fetchAddressByCep(digits);
      if (!found?.city) {
        setCepError("CEP não encontrado.");
        lastFetchedCep.current = null;
        return;
      }
      lastFetchedCep.current = digits;
      setCity(found.city);
      setStateUf(found.state);
    } catch {
      lastFetchedCep.current = null;
      setCepError("Não foi possível buscar o CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!courtName.trim()) {
      setError("Informe o nome da quadra.");
      return;
    }
    if (!city.trim()) {
      setError("Informe um CEP válido para preencher a cidade.");
      return;
    }
    if (!startsAt) {
      setError("Informe data e horário.");
      return;
    }

    const cityToSave =
      formatProfileLocation({ zip: cep, city, state: stateUf })?.slice(0, 80) ||
      city.trim().slice(0, 80);

    await guard(async () => {
      const { error: updateErr } = await updateOpenMatch(supabase, match.id, {
        courtName,
        city: cityToSave,
        startsAt: new Date(startsAt).toISOString(),
      });
      if (updateErr) {
        setError(updateErr);
        return;
      }
      onChanged();
      onClose();
    });
  }

  async function handleRespond(userId: string, accept: boolean) {
    setError(null);
    await guard(async () => {
      const { error: respErr } = await respondOpenMatchJoin(
        supabase,
        match.id,
        userId,
        accept
      );
      if (respErr) {
        setError(respErr);
        return;
      }
      onChanged();
    });
  }

  async function handleKick(userId: string) {
    setError(null);
    await guard(async () => {
      const { error: kickErr } = await kickOpenMatchPlayer(supabase, match.id, userId);
      if (kickErr) {
        setError(kickErr);
        return;
      }
      onChanged();
    });
  }

  async function handleInvite(user: OpenMatchProfileSearchResult) {
    setError(null);
    setInviteMessage(null);
    await guard(async () => {
      const { error: invErr } = await inviteToOpenMatch(supabase, match.id, user.id);
      if (invErr) {
        setError(invErr);
        return;
      }
      setInviteMessage(`Convite enviado para @${user.username}`);
      setInviteQuery("");
      setInviteResults([]);
      onChanged();
    });
  }

  async function handleDelete() {
    setError(null);
    await guard(async () => {
      const { error: delErr } = await cancelOpenMatch(supabase, match.id);
      if (delErr) {
        setError(delErr);
        return;
      }
      onChanged();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(92dvh,760px)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-[var(--toq-card)] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--toq-border)] px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-[var(--toq-text)]">
              Gerenciar #{match.match_number}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
              Edite, aceite pedidos ou expulse jogadores.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--toq-border)] px-3 py-1.5 text-xs font-semibold text-[var(--toq-text)]"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {error && (
            <p
              className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              role="alert"
            >
              {error}
            </p>
          )}

          <form id="edit-open-match" onSubmit={handleSave} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Local e horário
            </p>

            <label className="block">
              <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">
                Nome da quadra
              </span>
              <input
                value={courtName}
                onChange={(e) => setCourtName(e.target.value.slice(0, 80))}
                required
                className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
              />
            </label>

            <div>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">CEP</span>
                <input
                  value={formatCepDisplay(cep)}
                  onChange={(e) => {
                    setCepError(null);
                    const digits = normalizeCep(e.target.value);
                    if (digits !== lastFetchedCep.current) {
                      lastFetchedCep.current = null;
                    }
                    setCep(digits);
                    if (digits.length === 8) void lookupCep(digits);
                  }}
                  onBlur={() => void lookupCep(cep)}
                  inputMode="numeric"
                  placeholder="Novo CEP para atualizar a cidade"
                  maxLength={9}
                  className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
                />
              </label>
              {cepLoading && (
                <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">Buscando cidade…</p>
              )}
              {cepError && (
                <p className="mt-1 text-[11px] text-red-400" role="alert">
                  {cepError}
                </p>
              )}
              {locationLabel && !cepLoading && (
                <p className="mt-1.5 text-sm font-semibold text-[var(--toq-text)]">
                  {locationLabel}
                </p>
              )}
              {!cep && (
                <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
                  Cidade atual: {match.city || "—"}. Digite um CEP só se quiser alterar.
                </p>
              )}
            </div>

            <label className="block">
              <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">
                Data e horário
              </span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
              />
            </label>
          </form>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Convidar jogador
            </p>
            <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
              Busque por @usuário, nome ou id. Depois que a pessoa aceitar, o pedido
              aparece em pendentes para você confirmar.
            </p>
            <div className="relative mt-2">
              <input
                value={inviteQuery}
                onChange={(e) => {
                  setInviteMessage(null);
                  setInviteQuery(e.target.value);
                }}
                placeholder="@usuario ou id…"
                className="w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
              />
              {(inviteSearching || inviteResults.length > 0 || inviteQuery.trim().length >= 2) && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[var(--toq-border)] bg-[var(--toq-card)] py-1 shadow-lg">
                  {inviteSearching && inviteResults.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-[var(--toq-text-muted)]">Buscando…</li>
                  ) : inviteResults.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-[var(--toq-text-muted)]">
                      Nenhum usuário encontrado
                    </li>
                  ) : (
                    inviteResults.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void handleInvite(u)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--toq-input-bg)]"
                        >
                          <ProfileAvatar
                            src={u.avatar_url}
                            name={profileDisplayName({
                              display_name: u.display_name,
                              username: u.username,
                            })}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[var(--toq-text)]">
                              @{u.username}
                            </span>
                            {u.display_name && (
                              <span className="block truncate text-[11px] text-[var(--toq-text-muted)]">
                                {u.display_name}
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-bold text-[var(--toq-accent)]">
                            Convidar
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            {inviteMessage && (
              <p className="mt-2 text-xs font-semibold text-emerald-400">{inviteMessage}</p>
            )}
            {invited.length > 0 && (
              <ul className="mt-3 space-y-2">
                {invited.map((p) => (
                  <li
                    key={p.user_id}
                    className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5"
                  >
                    <ProfileAvatar
                      src={p.avatar_url}
                      name={profileDisplayName({
                        display_name: p.display_name,
                        username: p.username,
                      })}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--toq-text)]">
                        @{p.username}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                        Aguardando resposta do convite
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Pedidos pendentes
            </p>
            <ul className="mt-2 space-y-2">
              {pending.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--toq-border)] px-3 py-3 text-center text-sm text-[var(--toq-text-muted)]">
                  Nenhum pedido pendente.
                </li>
              ) : (
                pending.map((p) => (
                  <li
                    key={p.user_id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--toq-border)] px-3 py-2.5"
                  >
                    <ProfileAvatar
                      src={p.avatar_url}
                      name={profileDisplayName({
                        display_name: p.display_name,
                        username: p.username,
                      })}
                      size="sm"
                    />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--toq-text)]">
                          @{p.username}
                        </p>
                        {p.day_use_accepted && (
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                            Day use aceito
                          </p>
                        )}
                      </div>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleRespond(p.user_id, false)}
                      className="text-xs font-semibold text-red-400"
                    >
                      Recusar
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleRespond(p.user_id, true)}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Aceitar
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Jogadores na partida
            </p>
            <ul className="mt-2 space-y-2">
              {confirmed.map((p) => {
                const isCreator = p.user_id === match.created_by;
                return (
                  <li
                    key={p.user_id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--toq-border)] px-3 py-2.5"
                  >
                    <ProfileAvatar
                      src={p.avatar_url}
                      name={profileDisplayName({
                        display_name: p.display_name,
                        username: p.username,
                      })}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--toq-text)]">
                        @{p.username}
                        {isCreator ? " · criador" : ""}
                      </p>
                      <p className="text-[11px] text-[var(--toq-text-muted)]">Time {p.team}</p>
                    </div>
                    {!isCreator && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleKick(p.user_id)}
                        className="rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-400"
                      >
                        Expulsar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-6 space-y-2">
            {match.status !== "done" && match.status !== "cancelled" && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setScoreOpen(true)}
                className="w-full rounded-2xl bg-[var(--toq-accent)] py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Registrar placar e encerrar
              </button>
            )}
            <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-3">
            {!confirmDelete ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setConfirmDelete(true)}
                className="w-full text-sm font-semibold text-red-400"
              >
                Excluir partida
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-[var(--toq-text)]">
                  Excluir a partida #{match.match_number}? Quem estiver nela será notificado.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-xl border border-[var(--toq-border)] py-2 text-sm font-semibold text-[var(--toq-text)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleDelete()}
                    className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {isSubmitting ? "…" : "Confirmar exclusão"}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--toq-border)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="submit"
            form="edit-open-match"
            disabled={isSubmitting || cepLoading || match.status === "done"}
            className="w-full rounded-2xl bg-[var(--toq-accent)] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>

      {scoreOpen && (
        <CompleteMatchResultModal
          match={match}
          onClose={() => setScoreOpen(false)}
          onDone={() => {
            setScoreOpen(false);
            onChanged();
            onClose();
          }}
        />
      )}
    </div>
  );
}
