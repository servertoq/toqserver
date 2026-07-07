import type { PlayerLevelType } from "@/lib/profile";
import { playerLevelLabel } from "@/lib/profile";

type Props = {
  level: PlayerLevelType;
  className?: string;
};

export function ProfilePlayerLevelBadge({ level, className = "" }: Props) {
  const isPro = level === "profissional";
  const label = playerLevelLabel(level);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
        isPro
          ? "bg-amber-500/15 text-amber-700"
          : "bg-[var(--toq-profile-accent-soft)] text-[var(--toq-profile-accent)]"
      } ${className}`}
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
