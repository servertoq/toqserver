"use client";

import {
  formatTournamentDateRange,
  tournamentSignupUrl,
} from "@/lib/tournaments";
import type { ClubTournament } from "@/types/clubFeatures";

type Props = {
  tournament: ClubTournament;
  clubName: string;
  username: string;
  open: boolean;
  onClose: () => void;
  canSignup?: boolean;
  canShare?: boolean;
  onShare?: () => void;
};

export function TournamentDetailDialog({
  tournament,
  clubName,
  username,
  open,
  onClose,
  canSignup = true,
  canShare = false,
  onShare,
}: Props) {
  if (!open) return null;

  const dateRange = formatTournamentDateRange(tournament.starts_at, tournament.ends_at);
  const signupHref = canSignup
    ? tournamentSignupUrl(
        tournament.contact_whatsapp,
        tournament.name,
        clubName,
        username
      )
    : null;
  const cityLabel = [tournament.community?.address_city, tournament.community?.address_state]
    .filter(Boolean)
    .join(" · ");
  const cover = tournament.image_url || tournament.community?.cover_image_url;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-detail-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-[#0b1220] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-40 shrink-0 bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-accent)] sm:h-48">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : null}
          {tournament.is_private && (
            <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white">
              Só membros
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white hover:bg-black/70"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:p-5 [-webkit-overflow-scrolling:touch]">
          <div>
            <p className="text-xs font-semibold text-[var(--toq-sky)]">{clubName}</p>
            <h2
              id="tournament-detail-title"
              className="mt-1 text-xl font-bold text-[var(--toq-navy)] dark:text-white"
            >
              {tournament.name}
            </h2>
            {dateRange && (
              <p className="mt-1.5 text-sm font-semibold text-[var(--toq-accent)]">{dateRange}</p>
            )}
            {cityLabel && (
              <p className="mt-1 text-sm text-[var(--toq-text-muted)]">{cityLabel}</p>
            )}
          </div>

          {tournament.description.trim() && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
                Descrição
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-navy)] dark:text-white/85">
                {tournament.description}
              </p>
            </section>
          )}

          <section className="rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-950/35">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
              Premiação
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950 dark:text-amber-100">
              {tournament.prizes}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Como funciona
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-navy)] dark:text-white/85">
              {tournament.how_it_works || "Sem detalhes extras."}
            </p>
          </section>

          <div className="flex flex-wrap gap-2 pt-1">
            {canSignup && signupHref ? (
              <a
                href={signupHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1ebe5d] sm:flex-none"
              >
                Inscrever
              </a>
            ) : tournament.is_private ? (
              <p className="w-full rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-[var(--toq-text-muted)] dark:bg-white/5">
                Torneio privado — entre no clube para se inscrever.
              </p>
            ) : null}

            {canShare && onShare && (
              <button
                type="button"
                onClick={onShare}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[var(--toq-navy)] transition hover:border-[var(--toq-accent)] dark:border-white/15 dark:text-white sm:flex-none"
              >
                Compartilhar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
