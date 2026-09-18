"use client";

import Link from "next/link";
import { profileDisplayName } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";
import {
  formatMatchSkillLevel,
  formatMatchWhen,
  formatDayUsePrice,
  openMatchFormatLabel,
  openMatchSpotsLeft,
  shortPlayerName,
} from "@/lib/openMatches";
import type { OpenMatchListItem, OpenMatchPlayer } from "@/types/openMatches";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type Props = {
  match: OpenMatchListItem;
  players?: OpenMatchPlayer[];
  currentUserId: string;
  onJoin: (match: OpenMatchListItem) => void;
  onManage?: (match: OpenMatchListItem) => void;
  onRespondInvite?: (match: OpenMatchListItem, accept: boolean) => void;
};

function TeamAvatars({
  players,
  fallbackName,
  fallbackAvatar,
}: {
  players: { username: string; display_name: string | null; avatar_url: string | null }[];
  fallbackName?: string;
  fallbackAvatar?: string | null;
}) {
  const list =
    players.length > 0
      ? players
      : fallbackName
        ? [{ username: fallbackName, display_name: null, avatar_url: fallbackAvatar ?? null }]
        : [];

  return (
    <div className="flex items-center justify-center">
      <div className="flex -space-x-2">
        {list.slice(0, 2).map((p, i) => (
          <div
            key={`${p.username}-${i}`}
            className="ring-2 ring-[var(--toq-card)] rounded-full"
            style={{ zIndex: 2 - i }}
          >
            <ProfileAvatar
              src={p.avatar_url}
              name={profileDisplayName({
                display_name: p.display_name,
                username: p.username,
              })}
              size="sm"
            />
          </div>
        ))}
        {list.length === 0 && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--toq-input-bg)] text-xs font-bold text-[var(--toq-text-muted)] ring-2 ring-[var(--toq-card)]">
            ?
          </div>
        )}
      </div>
    </div>
  );
}

export function OpenMatchCard({
  match,
  players = [],
  currentUserId,
  onJoin,
  onManage,
  onRespondInvite,
}: Props) {
  const confirmed = players.filter((p) => p.status === "confirmed");
  const team1 = confirmed.filter((p) => p.team === 1);
  const team2 = confirmed.filter((p) => p.team === 2);
  const spots = openMatchSpotsLeft(match);
  const isCreator = match.created_by === currentUserId;
  const alreadyIn = players.some(
    (p) => p.user_id === currentUserId && (p.status === "confirmed" || p.status === "pending")
  );
  const myPending = players.some(
    (p) => p.user_id === currentUserId && p.status === "pending"
  );
  const myInvited = players.some(
    (p) => p.user_id === currentUserId && p.status === "invited"
  );

  const team1Label =
    team1.length > 0
      ? team1
          .map((p) =>
            p.user_id === currentUserId
              ? "Você"
              : shortPlayerName(p.display_name, p.username)
          )
          .join(" + ")
      : shortPlayerName(match.creator_display_name, match.creator_username);

  const team2Label =
    team2.length > 0
      ? team2.map((p) => shortPlayerName(p.display_name, p.username)).join(" + ")
      : "Aguardando";

  const isClubMatch = Boolean(match.community_id);
  const showTeams = match.format !== "club";

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-[var(--toq-card)] ${
        isClubMatch
          ? "border-[var(--toq-accent)]/35 ring-1 ring-[var(--toq-accent)]/20"
          : "border-[var(--toq-border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--toq-accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--toq-accent)]">
            {openMatchFormatLabel(match.format)}
          </span>
          {isClubMatch && (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
              {match.viewer_is_member ? "Seu clube" : "Day use"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--toq-text-muted)]">
          {match.has_password && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-400">
              Com senha
            </span>
          )}
          <span className="font-semibold">#{match.match_number}</span>
        </div>
      </div>

      {isClubMatch && match.community_name && (
        <div className="px-4 pb-1 sm:px-5">
          <p className="text-sm font-semibold text-[var(--toq-text)]">{match.community_name}</p>
          {!match.viewer_is_member && (
            <p className="text-[11px] text-[var(--toq-text-muted)]">
              Day use: {formatDayUsePrice(match.day_use_price)}
            </p>
          )}
        </div>
      )}

      {showTeams ? (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4 sm:gap-4 sm:px-5">
        <div className="min-w-0 text-center">
          <TeamAvatars
            players={team1.map((p) => ({
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
            }))}
            fallbackName={match.creator_username}
            fallbackAvatar={match.creator_avatar_url}
          />
          <p className="mt-2 truncate text-sm font-semibold text-[var(--toq-text)]">
            {team1Label}
          </p>
          <p className="text-[11px] text-[var(--toq-text-muted)]">
            Nível {formatMatchSkillLevel(match.skill_level)}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--toq-accent)] text-[10px] font-bold text-white">
          VS
        </div>

        <div className="min-w-0 text-center">
          <TeamAvatars
            players={team2.map((p) => ({
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
            }))}
          />
          <p className="mt-2 truncate text-sm font-semibold text-[var(--toq-text)]">
            {team2Label}
          </p>
          <p className="text-[11px] text-[var(--toq-text-muted)]">
            {team2.length > 0
              ? `Nível ${formatMatchSkillLevel(match.skill_level)}`
              : "Vagas abertas"}
          </p>
        </div>
      </div>
      ) : (
      <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
        <TeamAvatars
          players={confirmed.map((p) => ({
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
          }))}
          fallbackName={match.creator_username}
          fallbackAvatar={match.creator_avatar_url}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--toq-text)]">
            {confirmed.length > 0
              ? confirmed
                  .slice(0, 3)
                  .map((p) =>
                    p.user_id === currentUserId
                      ? "Você"
                      : shortPlayerName(p.display_name, p.username)
                  )
                  .join(", ")
              : shortPlayerName(match.creator_display_name, match.creator_username)}
            {confirmed.length > 3 ? ` +${confirmed.length - 3}` : ""}
          </p>
          <p className="text-[11px] text-[var(--toq-text-muted)]">
            {confirmed.length}/{match.capacity} confirmados
          </p>
        </div>
      </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--toq-border)] px-4 py-3 text-xs text-[var(--toq-text-muted)] sm:px-5">
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M8 2v4M16 2v4M3 10h18" />
          </svg>
          {formatMatchWhen(match.starts_at)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" />
          </svg>
          {match.court_name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" />
          </svg>
          {match.capacity} jogadores
        </span>
        {match.city && (
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {match.city}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--toq-border)] px-4 py-3 sm:px-5">
        <p className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              spots > 0 ? "bg-orange-500" : "bg-emerald-500"
            }`}
          />
          <span className="font-medium text-[var(--toq-text)]">
            {spots > 0
              ? `${spots} vaga${spots > 1 ? "s" : ""} ${spots > 1 ? "disponíveis" : "disponível"}`
              : "Partida completa"}
          </span>
          {match.pending_count > 0 && isCreator && (
            <span className="text-xs text-amber-400">
              · {match.pending_count} pedido{match.pending_count > 1 ? "s" : ""}
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-2">
          <Link
            href={profilePath(match.creator_username)}
            className="rounded-full border border-[var(--toq-border)] px-3 py-2 text-xs font-semibold text-[var(--toq-text)] hover:bg-[var(--toq-input-bg)]"
          >
            @{match.creator_username}
          </Link>
          {isCreator && onManage ? (
            <button
              type="button"
              onClick={() => onManage(match)}
              className="rounded-full bg-[var(--toq-accent)] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
            >
              Gerenciar
            </button>
          ) : myInvited && onRespondInvite ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onRespondInvite(match, false)}
                className="rounded-full border border-red-500/40 px-3 py-2 text-xs font-bold text-red-400"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={() => onRespondInvite(match, true)}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
              >
                Quero participar
              </button>
            </div>
          ) : myPending ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs font-bold text-amber-400">
              Aguardando aceite
            </span>
          ) : alreadyIn ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-400">
              Você está dentro
            </span>
          ) : spots > 0 && match.status === "open" ? (
            <button
              type="button"
              onClick={() => onJoin(match)}
              className="rounded-full border border-[var(--toq-accent)] bg-transparent px-4 py-2 text-xs font-bold text-[var(--toq-accent)] transition hover:bg-[var(--toq-accent)] hover:text-white"
            >
              Entrar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
