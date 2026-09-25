"use client";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { profileDisplayName } from "@/lib/profile";
import type { MatchSetScore } from "@/types/feed";

export type ScoreboardPlayer = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type DisplayProps = {
  team1: ScoreboardPlayer[];
  team2: ScoreboardPlayer[];
  sets: MatchSetScore[];
  formatLabel?: string;
  footer?: React.ReactNode;
};

const SET_HEADERS = ["1º SET", "2º SET", "3º SET"] as const;

function TeamAvatars({
  players,
  ringClass,
  overlap,
}: {
  players: ScoreboardPlayer[];
  ringClass: string;
  overlap: boolean;
}) {
  const list = players.slice(0, 2);
  if (list.length === 0) {
    return (
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/50 ${ringClass}`}
      >
        ?
      </div>
    );
  }

  const isDoubles = list.length > 1;

  return (
    <div
      className={`flex items-center justify-center ${overlap && isDoubles ? "gap-0.5" : "gap-1"}`}
    >
      {list.map((p) => (
        <div key={p.user_id} className="shrink-0">
          <ProfileAvatar
            src={p.avatar_url}
            name={profileDisplayName({
              display_name: p.display_name,
              username: p.username,
            })}
            size={isDoubles ? "sm" : "md"}
            ringClassName={`ring-2 ${ringClass}`}
          />
        </div>
      ))}
    </div>
  );
}

function ScoreCell({ value }: { value: number | null }) {
  const display = value == null ? "—" : String(value);
  return (
    <div className="flex min-h-[2.75rem] items-center justify-center rounded-lg bg-white/[0.12] px-2 py-2 text-xl font-bold tabular-nums text-white sm:min-h-[3rem] sm:text-2xl">
      {display}
    </div>
  );
}

export function MatchScoreboardDisplay({
  team1,
  team2,
  sets,
  formatLabel,
  footer,
}: DisplayProps) {
  const paddedSets: MatchSetScore[] = [0, 1, 2].map((i) => sets[i] ?? { team1: null, team2: null });

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--toq-border)]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0a0a0a 0%, #141414 50%, #0a0a0a 100%)",
        }}
      />
      <div className="relative z-[1] p-4 text-white sm:p-5">
        {formatLabel && (
          <span className="inline-flex rounded-full border border-white/25 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/90">
            {formatLabel}
          </span>
        )}

        <div
          className="mt-4 grid items-center gap-x-2 gap-y-3 sm:gap-x-3"
          style={{
            gridTemplateColumns: "minmax(4.5rem, auto) repeat(3, minmax(0, 1fr))",
          }}
        >
          <div />
          {SET_HEADERS.map((label) => (
            <p
              key={label}
              className="text-center text-[10px] font-bold uppercase tracking-wider text-white/55 sm:text-[11px]"
            >
              {label}
            </p>
          ))}

          <div className="flex justify-center">
            <TeamAvatars players={team1} ringClass="ring-[#f5c518]/90" overlap />
          </div>
          {paddedSets.map((s, i) => (
            <ScoreCell key={`t1-${i}`} value={s.team1} />
          ))}

          <div className="flex justify-center">
            <TeamAvatars players={team2} ringClass="ring-white/90" overlap />
          </div>
          {paddedSets.map((s, i) => (
            <ScoreCell key={`t2-${i}`} value={s.team2} />
          ))}
        </div>

        {footer && (
          <div className="mt-4 border-t border-white/12 pt-3 text-[11px] text-white/75">{footer}</div>
        )}
      </div>
    </div>
  );
}

type EditProps = {
  team1: ScoreboardPlayer[];
  team2: ScoreboardPlayer[];
  sets: { team1: string; team2: string }[];
  onSetChange: (index: number, side: "team1" | "team2", value: string) => void;
};

function ScoreInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
      className="w-full min-h-[2.75rem] rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-center text-xl font-bold tabular-nums text-white outline-none focus:border-[var(--toq-accent)] sm:min-h-[3rem] sm:text-2xl"
    />
  );
}

export function MatchScoreboardEdit({ team1, team2, sets, onSetChange }: EditProps) {
  return (
    <div className="rounded-2xl border border-[var(--toq-border)] bg-[#0f0f0f] p-4">
      <div
        className="grid items-center gap-x-2 gap-y-3 sm:gap-x-3"
        style={{
          gridTemplateColumns: "minmax(4.5rem, auto) repeat(3, minmax(0, 1fr))",
        }}
      >
        <div />
        {SET_HEADERS.map((label) => (
          <p
            key={label}
            className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--toq-text-muted)]"
          >
            {label}
          </p>
        ))}

        <div className="flex justify-center">
          <TeamAvatars
            players={team1}
            ringClass="ring-[#f5c518]/90"
            overlap
          />
        </div>
        {[0, 1, 2].map((i) => (
          <ScoreInput
            key={`e1-${i}`}
            value={sets[i]?.team1 ?? ""}
            onChange={(v) => onSetChange(i, "team1", v)}
          />
        ))}

        <div className="flex justify-center">
          <TeamAvatars players={team2} ringClass="ring-white/80" overlap />
        </div>
        {[0, 1, 2].map((i) => (
          <ScoreInput
            key={`e2-${i}`}
            value={sets[i]?.team2 ?? ""}
            onChange={(v) => onSetChange(i, "team2", v)}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-[var(--toq-text-muted)]">
        Pontuação de cada equipe em cada set (melhor de 3).
      </p>
    </div>
  );
}
