"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveReportTargetHref, ticketStatusLabel } from "@/lib/staffTickets";
import type { SupportTicketWithReporter } from "@/types/support";

type Props = {
  ticket: SupportTicketWithReporter;
  canModerate: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export function StaffTicketDetailModal({ ticket, canModerate, onClose, onUpdated }: Props) {
  const supabase = createClient();
  const [targetHref, setTargetHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportNote, setSupportNote] = useState("");

  useEffect(() => {
    resolveReportTargetHref(supabase, ticket.target_type, ticket.target_id).then(setTargetHref);
  }, [supabase, ticket.target_id, ticket.target_type]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  async function runAction(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setLoading(true);
    setError(null);
    const { error: err } = await fn();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    onUpdated();
    onClose();
    setLoading(false);
  }

  const isReport = ticket.topic === "report";
  const isSuggestion = ticket.topic === "suggestion";
  const isSupport = ticket.topic === "help";
  const resolved = ticket.status === "resolved";

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
              {isReport ? "Denúncia" : isSuggestion ? "Sugestão" : "Suporte"} ·{" "}
              {ticketStatusLabel(ticket.status)}
            </p>
            <h2 className="mt-1 text-base font-bold text-[var(--toq-navy)]">{ticket.title}</h2>
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
              @{ticket.reporter?.username ?? "usuário"}
            </p>
            {ticket.reporter?.email && (
              <p className="mt-0.5 text-[var(--toq-text-muted)]">{ticket.reporter.email}</p>
            )}
            <p className="mt-1 text-[var(--toq-text-muted)]">
              {new Date(ticket.created_at).toLocaleString("pt-BR")}
            </p>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-navy)]">
            {ticket.description}
          </p>

          {ticket.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ticket.image_url}
              alt=""
              className="max-h-48 w-full rounded-xl border border-slate-200 object-cover"
            />
          )}

          {isReport && ticket.target_type && ticket.target_id && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs">
              <p className="font-semibold text-amber-900">
                Alvo: {ticket.target_type} · {ticket.target_id.slice(0, 8)}…
              </p>
              {targetHref && (
                <Link
                  href={targetHref}
                  target="_blank"
                  className="mt-1 inline-block font-semibold text-[var(--toq-accent)] hover:underline"
                >
                  Ver conteúdo denunciado →
                </Link>
              )}
            </div>
          )}

          {resolved && ticket.resolution_outcome && (
            <p className="text-xs text-[var(--toq-text-muted)]">
              Resultado:{" "}
              {ticket.resolution_outcome === "upheld" ? "Procedente" : "Improcedente"}
            </p>
          )}

          {!resolved && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              {isReport && canModerate && (
                <>
                  {ticket.target_type === "post" && ticket.target_id && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        runAction(() => supabase.rpc("staff_delete_post", { p_post_id: ticket.target_id }))
                      }
                      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600"
                    >
                      Excluir publicação denunciada
                    </button>
                  )}
                  {ticket.target_type === "community" && ticket.target_id && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        runAction(() =>
                          supabase.rpc("staff_delete_community", { p_community_id: ticket.target_id })
                        )
                      }
                      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600"
                    >
                      Excluir comunidade/clube
                    </button>
                  )}
                  {ticket.target_type === "profile" && ticket.target_id && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        runAction(() =>
                          supabase.rpc("staff_ban_user", {
                            p_user_id: ticket.target_id,
                            p_reason: "Denúncia procedente",
                          })
                        )
                      }
                      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600"
                    >
                      Banir perfil denunciado
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      runAction(() =>
                        supabase.rpc("staff_resolve_report", {
                          p_ticket_id: ticket.id,
                          p_outcome: "upheld",
                        })
                      )
                    }
                    className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white"
                  >
                    Marcar resolvida (procedente)
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      runAction(() =>
                        supabase.rpc("staff_resolve_report", {
                          p_ticket_id: ticket.id,
                          p_outcome: "dismissed",
                        })
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[var(--toq-navy)]"
                  >
                    Marcar resolvida (improcedente)
                  </button>
                </>
              )}

              {isSuggestion && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    runAction(() =>
                      supabase.rpc("staff_acknowledge_suggestion", { p_ticket_id: ticket.id })
                    )
                  }
                  className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white"
                >
                  Marcar como lida e notificar usuário
                </button>
              )}

              {isSupport && canModerate && (
                <>
                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--toq-navy)]">
                      Nota interna (opcional)
                    </span>
                    <input
                      value={supportNote}
                      onChange={(e) => setSupportNote(e.target.value)}
                      placeholder="Ex.: contato feito por e-mail"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      runAction(() =>
                        supabase.rpc("staff_resolve_support", {
                          p_ticket_id: ticket.id,
                          p_note: supportNote,
                        })
                      )
                    }
                    className="w-full rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white"
                  >
                    Marcar suporte como resolvido
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
