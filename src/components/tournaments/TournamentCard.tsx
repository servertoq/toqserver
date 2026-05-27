"use client";

import Link from "next/link";
import {
  formatTournamentDateRange,
  tournamentClubHref,
  tournamentSignupUrl,
} from "@/lib/tournaments";
import type { ClubTournament } from "@/types/clubFeatures";

type Props = {
  tournament: ClubTournament;
  clubName: string;
  username: string;
  showClubLink?: boolean;
  canSignup?: boolean;
};

export function TournamentCard({
  tournament,
  clubName,
  username,
  showClubLink = true,
  canSignup = true,
}: Props) {
  const dateRange = formatTournamentDateRange(tournament.starts_at, tournament.ends_at);
  const clubHref = tournamentClubHref(tournament);
  const signupHref = canSignup
    ? tournamentSignupUrl(
        tournament.contact_whatsapp,
        tournament.name,
        clubName,
        username
      )
    : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-[var(--toq-navy)] to-[var(--toq-sky)]">
        {tournament.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tournament.image_url} alt="" className="h-full w-full object-cover" />
        ) : tournament.community?.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tournament.community.cover_image_url}
            alt=""
            className="h-full w-full object-cover opacity-90"
          />
        ) : null}
        {tournament.is_private && (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
            Só membros
          </span>
        )}
      </div>

      <div className="p-4">
        {showClubLink && clubHref ? (
          <Link
            href={clubHref}
            className="text-xs font-semibold text-[var(--toq-sky)] hover:underline"
          >
            {clubName}
          </Link>
        ) : (
          <p className="text-xs font-semibold text-[var(--toq-text-muted)]">{clubName}</p>
        )}

        <h2 className="mt-1 text-lg font-bold text-[var(--toq-navy)]">{tournament.name}</h2>

        {dateRange && (
          <p className="mt-1 text-xs font-medium text-[var(--toq-lime-dark)]">{dateRange}</p>
        )}

        <p className="mt-2 line-clamp-3 text-sm text-[var(--toq-text-muted)]">
          {tournament.description}
        </p>

        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Premiação</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-950">{tournament.prizes}</p>
        </div>

        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--toq-navy)] marker:content-none">
            <span className="group-open:hidden">Como funciona ▾</span>
            <span className="hidden group-open:inline">Como funciona ▴</span>
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--toq-text-muted)]">
            {tournament.how_it_works}
          </p>
        </details>

        {canSignup && signupHref ? (
          <a
            href={signupHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1ebe5d]"
          >
            Inscrever-se no WhatsApp
          </a>
        ) : tournament.is_private ? (
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-[var(--toq-text-muted)]">
            Torneio privado — entre no clube para se inscrever.
          </p>
        ) : null}
      </div>
    </article>
  );
}
