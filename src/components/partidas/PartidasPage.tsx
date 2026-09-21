"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { appContentClass } from "@/lib/layout";
import {
  getOpenMatchDetail,
  joinOpenMatch,
  needsDayUseFlow,
  respondOpenMatchInvite,
  searchOpenMatches,
} from "@/lib/openMatches";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { OpenMatchDetail, OpenMatchListItem, OpenMatchPlayer } from "@/types/openMatches";
import { OpenMatchCard } from "./OpenMatchCard";
import { CreateOpenMatchModal } from "./CreateOpenMatchModal";
import { ManageOpenMatchModal } from "./ManageOpenMatchModal";
import { DayUseJoinModal } from "./DayUseJoinModal";

export function PartidasPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<OpenMatchListItem[]>([]);
  const [playersByMatch, setPlayersByMatch] = useState<Record<string, OpenMatchPlayer[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinTarget, setJoinTarget] = useState<OpenMatchListItem | null>(null);
  const [dayUseTarget, setDayUseTarget] = useState<OpenMatchListItem | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [manageTarget, setManageTarget] = useState<OpenMatchDetail | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const { isSubmitting, guard } = useSingleSubmit();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { items: rows, error: searchErr } = await searchOpenMatches(supabase, query);
    if (searchErr) {
      setError(
        searchErr.includes("search_open_matches") || searchErr.includes("Could not find")
          ? "Execute as migrations de partidas (088–100) no Supabase."
          : searchErr
      );
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(rows);

    const map: Record<string, OpenMatchPlayer[]> = {};
    await Promise.all(
      rows.slice(0, 20).map(async (m) => {
        const { match } = await getOpenMatchDetail(supabase, m.id);
        if (match) map[m.id] = match.players;
      })
    );
    setPlayersByMatch(map);
    setLoading(false);
  }, [query, supabase]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  function requestJoin(match: OpenMatchListItem) {
    setActionError(null);
    setJoinPassword("");
    if (needsDayUseFlow(match)) {
      setDayUseTarget(match);
      return;
    }
    setJoinTarget(match);
  }

  async function handleJoinConfirm(opts?: {
    match?: OpenMatchListItem;
    dayUseAccepted?: boolean;
  }) {
    const target = opts?.match ?? joinTarget;
    if (!target || isSubmitting) return;
    setActionError(null);
    await guard(async () => {
      const { error: joinErr } = await joinOpenMatch(supabase, target.id, {
        password: target.has_password ? joinPassword : undefined,
        dayUseAccepted: opts?.dayUseAccepted,
      });
      if (joinErr) {
        setActionError(joinErr);
        return;
      }
      setJoinTarget(null);
      setDayUseTarget(null);
      setJoinPassword("");
      await load();
    });
  }

  async function openManage(match: OpenMatchListItem) {
    setActionError(null);
    const { match: detail, error: detailErr } = await getOpenMatchDetail(supabase, match.id);
    if (detailErr || !detail) {
      setActionError(detailErr ?? "Não foi possível carregar a partida.");
      return;
    }
    setManageTarget(detail);
  }

  async function refreshManage() {
    if (!manageTarget) {
      await load();
      return;
    }
    const id = manageTarget.id;
    const { match: detail } = await getOpenMatchDetail(supabase, id);
    if (detail && detail.status !== "cancelled") {
      setManageTarget(detail);
    } else {
      setManageTarget(null);
    }
    await load();
  }

  async function handleRespondInvite(match: OpenMatchListItem, accept: boolean) {
    setActionError(null);
    await guard(async () => {
      const { error: respErr } = await respondOpenMatchInvite(supabase, match.id, accept);
      if (respErr) {
        setActionError(respErr);
        return;
      }
      await load();
    });
  }

  return (
    <main className={appContentClass}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--toq-text)]">Partidas</h1>
            <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
              Crie ou entre em jogos 1vs1 e 2vs2 perto de você.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-2xl bg-[var(--toq-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90"
          >
            + Criar partida
          </button>
        </header>

        <div className="mb-5 rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-3">
          <label className="block">
            <span className="sr-only">Buscar partidas</span>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-input-bg)] px-3 py-2.5">
              <svg
                className="h-4 w-4 shrink-0 text-[var(--toq-text-muted)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nº, @usuário, cidade, clube ou id…"
                className="w-full bg-transparent text-sm text-[var(--toq-text)] outline-none placeholder:text-[var(--toq-text-muted)]"
              />
            </div>
          </label>
        </div>

        {error && (
          <p
            className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando partidas…</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--toq-border)] bg-[var(--toq-card)] px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--toq-accent-soft)] text-[var(--toq-accent)]">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18M3 12h18" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--toq-text)]">Nenhuma partida por aqui</p>
            <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
              Crie a primeira e chame outros jogadores.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 rounded-full bg-[var(--toq-accent)] px-5 py-2.5 text-xs font-bold text-white"
            >
              Criar partida
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((m) => (
              <li key={m.id}>
                <OpenMatchCard
                  match={m}
                  players={playersByMatch[m.id] ?? []}
                  currentUserId={profile.id}
                  onJoin={requestJoin}
                  onManage={(match) => void openManage(match)}
                  onRespondInvite={(match, accept) => void handleRespondInvite(match, accept)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateOpenMatchModal
        open={createOpen}
        defaultCity=""
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />

      {portalReady &&
        joinTarget &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Fechar"
              onClick={() => setJoinTarget(null)}
            />
            <div className="relative z-[1] w-full max-w-md rounded-t-3xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
              <h3 className="text-base font-bold text-[var(--toq-text)]">
                Entrar na partida #{joinTarget.match_number}
              </h3>
              {joinTarget.has_password ? (
                <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
                  Esta partida é protegida. Digite a senha para entrar.
                </p>
              ) : (
                <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
                  Seu pedido será enviado ao criador para aceite.
                </p>
              )}
              {joinTarget.has_password && (
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="Senha"
                  className="mt-3 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
                  autoFocus
                />
              )}
              {actionError && (
                <p className="mt-2 text-sm text-red-400" role="alert">
                  {actionError}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setJoinTarget(null)}
                  className="flex-1 rounded-xl border border-[var(--toq-border)] py-2.5 text-sm font-semibold text-[var(--toq-text)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleJoinConfirm()}
                  className="flex-1 rounded-xl bg-[var(--toq-accent)] py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {isSubmitting ? "…" : joinTarget.has_password ? "Entrar" : "Pedir para entrar"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {dayUseTarget && (
        <DayUseJoinModal
          match={dayUseTarget}
          submitting={isSubmitting}
          error={actionError}
          onClose={() => {
            setDayUseTarget(null);
            setActionError(null);
          }}
          onConfirm={() =>
            void handleJoinConfirm({ match: dayUseTarget, dayUseAccepted: true })
          }
        />
      )}

      {manageTarget && (
        <ManageOpenMatchModal
          match={manageTarget}
          onClose={() => setManageTarget(null)}
          onChanged={() => void refreshManage()}
        />
      )}
    </main>
  );
}
