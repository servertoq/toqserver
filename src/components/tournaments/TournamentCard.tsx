"use client";

import Link from "next/link";
import { useState } from "react";
import {
  formatTournamentDateRange,
  tournamentClubHref,
  tournamentLocationLabel,
  tournamentOrganizerLabel,
  tournamentSignupUrl,
} from "@/lib/tournaments";
import type { ClubTournament } from "@/types/clubFeatures";
import { ShareTournamentDialog } from "./ShareTournamentDialog";
import { TournamentDetailDialog } from "./TournamentDetailDialog";

type Props = {
  tournament: ClubTournament;
  clubName?: string;
  username: string;
  showClubLink?: boolean;
  canSignup?: boolean;
  canShare?: boolean;
  /** Abre o Ver completo ao montar (ex.: link ?torneio=). */
  autoOpenDetail?: boolean;
};

function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M8 7l4-4 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 13v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TournamentCard({
  tournament,
  clubName,
  username,
  showClubLink = true,
  canSignup = true,
  canShare = false,
  autoOpenDetail = false,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(autoOpenDetail);
  const dateRange = formatTournamentDateRange(tournament.starts_at, tournament.ends_at);
  const clubHref = tournamentClubHref(tournament);
  const organizer = clubName || tournamentOrganizerLabel(tournament);
  const signupHref = canSignup
    ? tournamentSignupUrl(
        tournament.contact_whatsapp,
        tournament.name,
        organizer,
        username
      )
    : null;

  const cityLabel = tournamentLocationLabel(tournament);

  const shareEnabled = canShare && tournament.is_active;
  const cover = tournament.image_url || tournament.community?.cover_image_url;

  return (
    <article
      id={`torneio-${tournament.id}`}
      className="tournament-card flex flex-col overflow-hidden toq-card-lg"
    >
      {/* Foto do card — mesma capa do Ver completo */}
      <div className="relative aspect-[16/9] max-h-36 w-full shrink-0 overflow-hidden bg-[#0a1628]">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="absolute inset-0 block h-full w-full"
          aria-label={`Ver completo: ${tournament.name}`}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="block h-full w-full bg-gradient-to-br from-[#051024] to-[#2563eb]" />
          )}
        </button>
        {tournament.is_private && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            Privado
          </span>
        )}
        {shareEnabled && (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="absolute right-2 top-2 z-[1] inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
            aria-label="Compartilhar torneio"
            title="Compartilhar"
          >
            <ShareIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        {showClubLink && clubHref ? (
          <Link
            href={clubHref}
            className="truncate text-[11px] font-semibold text-[var(--toq-sky)] hover:underline"
          >
            {organizer}
          </Link>
        ) : (
          <p className="truncate text-[11px] font-semibold text-[var(--toq-text-muted)]">
            {organizer}
            {!tournament.community_id ? " · Avulso" : ""}
          </p>
        )}

        <h2 className="line-clamp-2 text-sm font-bold leading-snug text-[var(--toq-text)]">
          {tournament.name}
        </h2>

        {dateRange && (
          <p className="text-[11px] font-semibold leading-snug text-[var(--toq-accent)]">
            {dateRange}
          </p>
        )}

        {cityLabel && (
          <p className="truncate text-[11px] text-[var(--toq-text-muted)]">{cityLabel}</p>
        )}

        {tournament.description.trim() && (
          <p className="line-clamp-2 text-xs leading-snug text-[var(--toq-text-muted)]">
            {tournament.description}
          </p>
        )}

        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="inline-flex min-w-0 flex-1 items-center justify-center rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-[var(--toq-text)] transition hover:border-[var(--toq-accent)] dark:border-white/15"
          >
            Ver completo
          </button>

          {canSignup && signupHref ? (
            <a
              href={signupHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#25D366] px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1ebe5d]"
            >
              Inscrever
            </a>
          ) : null}
        </div>
      </div>

      <TournamentDetailDialog
        tournament={tournament}
        clubName={organizer}
        username={username}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        canSignup={canSignup}
        canShare={shareEnabled}
        onShare={() => {
          setDetailOpen(false);
          setShareOpen(true);
        }}
      />

      {shareEnabled && (
        <ShareTournamentDialog
          tournament={tournament}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </article>
  );
}
