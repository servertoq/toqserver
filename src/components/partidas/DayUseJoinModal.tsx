"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { CLUB_POLICIES } from "@/lib/clubPolicies";
import { formatDayUsePrice } from "@/lib/openMatches";
import type { OpenMatchListItem } from "@/types/openMatches";

type Props = {
  match: OpenMatchListItem;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  submitting?: boolean;
  error?: string | null;
};

export function DayUseJoinModal({
  match,
  onClose,
  onConfirm,
  submitting = false,
  error = null,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<"info" | "policies">("info");
  const clubName = match.community_name ?? "Clube";
  const place = [match.community_city, match.community_state]
    .filter(Boolean)
    .join(" – ");
  const priceLabel = formatDayUsePrice(match.day_use_price);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-[var(--toq-card)] sm:max-h-[min(92dvh,720px)] sm:rounded-3xl">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {step === "info" ? (
            <>
              <h2 className="text-lg font-bold text-[var(--toq-text)]">
                Informações do clube
              </h2>

              <div className="mt-4 rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-input-bg)] p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--toq-accent-soft)]">
                    {match.community_cover_url ? (
                      <Image
                        src={match.community_cover_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--toq-accent)]">
                        {clubName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--toq-text)]">
                      {clubName}
                    </p>
                    {place && (
                      <p className="truncate text-xs text-[var(--toq-text-muted)]">{place}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-[var(--toq-text)]">Day use</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--toq-text)]">{priceLabel}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--toq-text-muted)]">
                    {match.day_use_price > 0
                      ? "Primeira vez no clube? O day use será cobrado ao confirmar sua participação."
                      : "Este clube oferece Day Use gratuito para visitantes nesta partida."}
                  </p>
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-500/15 px-3 py-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l7 3v6c0 5-3.5 9.4-7 11-3.5-1.6-7-6-7-11V5l7-3zm-1.2 13.2l5.5-5.5-1.4-1.4-4.1 4.1-2-2-1.4 1.4 3.4 3.4z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[var(--toq-text)]">
                      Você pode pedir para entrar
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--toq-text-muted)]">
                      Após aceitar as políticas, o criador da partida ainda precisa aprovar.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-3 text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => setStep("policies")}
                className="mt-5 w-full rounded-2xl bg-[var(--toq-accent)] py-3 text-sm font-bold text-white"
              >
                Continuar
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-[var(--toq-text)]">Políticas do clube</h2>
              <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
                Ao entrar na partida, você concorda com as regras:
              </p>

              <ul className="mt-4 space-y-3 rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-input-bg)] p-4">
                {CLUB_POLICIES.map((rule) => (
                  <li key={rule.title} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--toq-accent-soft)] text-[var(--toq-accent)]">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M8 12l3 3 5-6" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[var(--toq-text)]">{rule.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--toq-text-muted)]">
                        {rule.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <label className="mt-4 flex items-start gap-2.5 text-sm text-[var(--toq-text)]">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 accent-[var(--toq-accent)]"
                />
                <span>Li e concordo com as políticas do clube</span>
              </label>

              {error && (
                <p className="mt-3 text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("info")}
                  className="rounded-2xl border border-[var(--toq-border)] px-4 py-3 text-sm font-semibold text-[var(--toq-text)]"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={!accepted || submitting}
                  onClick={() => void onConfirm()}
                  className="flex-1 rounded-2xl bg-[var(--toq-accent)] py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {submitting ? "Enviando…" : "Confirmar participação"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
