"use client";

import { MatchScoreboardDisplay } from "@/components/partidas/MatchScoreboard";
import { shortPlayerName } from "@/lib/openMatches";
import { matchResultPayloadSets } from "@/lib/matchResultSets";
import type { MatchResultPayload } from "@/types/feed";

type Props = {
  result: MatchResultPayload;
  currentUserId: string;
};

function formatPlayedDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatLabel(format: string) {
  if (format === "1v1") return "Jogo simples";
  if (format === "club") return "Partida do clube";
  return "Jogo de duplas";
}

export function MatchResultBlock({ result, currentUserId }: Props) {
  const team1 = result.players.filter((p) => p.team === 1);
  const team2 = result.players.filter((p) => p.team === 2);
  const sets = matchResultPayloadSets(result);

  function sideLabel(players: typeof team1) {
    if (players.length === 0) return "—";
    return players
      .map((p) =>
        p.user_id === currentUserId
          ? "Você"
          : shortPlayerName(p.display_name, p.username)
      )
      .join(" + ");
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-xs font-semibold text-white/90">{sideLabel(team1)}</p>
        <p className="truncate text-xs font-semibold text-white/90">{sideLabel(team2)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/75">
        <span className="inline-flex max-w-[10rem] items-center gap-1.5 truncate sm:max-w-[14rem]">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span className="truncate">{result.location_label || "—"}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M8 2v4M16 2v4M3 10h18" />
          </svg>
          {formatPlayedDate(result.played_at)}
        </span>
        <span className="font-semibold tabular-nums text-white/90">
          Sets {result.team1_score}–{result.team2_score}
        </span>
      </div>
    </div>
  );

  return (
    <MatchScoreboardDisplay
      team1={team1}
      team2={team2}
      sets={sets}
      formatLabel={formatLabel(result.format)}
      footer={footer}
    />
  );
}
