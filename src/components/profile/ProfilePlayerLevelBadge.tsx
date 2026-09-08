import type { PlayerLevelType } from "@/lib/profile";
import { playerLevelLabel } from "@/lib/profile";

type Props = {
  level: PlayerLevelType;
  className?: string;
};

const LEVEL_STYLES: Record<PlayerLevelType, string> = {
  iniciante: "border-[var(--toq-profile-accent)] text-[var(--toq-profile-accent)]",
  intermediario: "border-sky-500 text-sky-700",
  avancado: "border-violet-500 text-violet-700",
  profissional: "border-amber-500 text-amber-700",
};

export function ProfilePlayerLevelBadge({ level, className = "" }: Props) {
  const label = playerLevelLabel(level);
  const isPro = level === "profissional";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${LEVEL_STYLES[level]} ${className}`}
      aria-label={`Nível: ${label}`}
    >
      {isPro ? (
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M8 4h8v3a4 4 0 01-8 0V4z" />
          <path d="M6 4H4v1a3 3 0 003 3M18 4h2v1a3 3 0 01-3 3" />
          <path d="M12 11v3M9 20h6M10 14h4v3H10z" />
        </svg>
      ) : null}
      {label}
    </span>
  );
}
