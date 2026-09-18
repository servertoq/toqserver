"use client";

import { shortPlayerName } from "@/lib/openMatches";
import { profileDisplayName } from "@/lib/profile";
import type { MatchResultPayload } from "@/types/feed";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

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

  function sideSkill(players: typeof team1) {
    const label = players[0]?.skill_label;
    return label ? `Nível ${label}` : "";
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--toq-border)]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(5,16,36,0.55) 0%, rgba(5,16,36,0.78) 100%), radial-gradient(ellipse at 50% 20%, rgba(37,99,235,0.45), transparent 55%)",
          backgroundColor: "#0b1f3a",
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent, transparent 48px, rgba(255,255,255,0.06) 48px, rgba(255,255,255,0.06) 49px), repeating-linear-gradient(0deg, transparent, transparent 48px, rgba(255,255,255,0.06) 48px, rgba(255,255,255,0.06) 49px)",
        }}
      />

      <div className="relative z-[1] p-4 text-white sm:p-5">
        <span className="inline-flex rounded-full border border-white/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/95">
          {formatLabel(result.format)}
        </span>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 text-center">
            <div className="flex justify-center -space-x-2">
              {team1.slice(0, 2).map((p) => (
                <div key={p.user_id} className="rounded-full ring-2 ring-white/20">
                  <ProfileAvatar
                    src={p.avatar_url}
                    name={profileDisplayName({
                      display_name: p.display_name,
                      username: p.username,
                    })}
                    size="md"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 truncate text-sm font-semibold">{sideLabel(team1)}</p>
            {sideSkill(team1) && (
              <p className="text-[11px] text-white/70">{sideSkill(team1)}</p>
            )}
          </div>

          <p className="px-1 text-3xl font-bold tracking-tight sm:text-4xl">
            {result.team1_score}
            <span className="mx-1.5 text-white/50">—</span>
            {result.team2_score}
          </p>

          <div className="min-w-0 text-center">
            <div className="flex justify-center -space-x-2">
              {team2.slice(0, 2).map((p) => (
                <div key={p.user_id} className="rounded-full ring-2 ring-white/20">
                  <ProfileAvatar
                    src={p.avatar_url}
                    name={profileDisplayName({
                      display_name: p.display_name,
                      username: p.username,
                    })}
                    size="md"
                  />
                </div>
              ))}
              {team2.length === 0 && (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/60">
                  ?
                </div>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-semibold">{sideLabel(team2)}</p>
            {sideSkill(team2) && (
              <p className="text-[11px] text-white/70">{sideSkill(team2)}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3 text-[11px] text-white/80">
          <span className="inline-flex max-w-[60%] items-center gap-1.5 truncate">
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
        </div>
      </div>
    </div>
  );
}
