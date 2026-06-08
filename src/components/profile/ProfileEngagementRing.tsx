type Props = {
  value: number;
  label: string;
  sublabel?: string;
};

export function ProfileEngagementRing({ value, label, sublabel }: Props) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88" aria-hidden>
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="var(--toq-profile-ring-bg)"
            strokeWidth="8"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="var(--toq-profile-accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[var(--toq-profile-navy)]">
          {clamped}%
        </span>
      </div>
      <p className="text-center text-xs font-semibold text-[var(--toq-profile-navy)]">{label}</p>
      {sublabel && (
        <p className="text-center text-[10px] uppercase tracking-wide text-[var(--toq-profile-muted)]">
          {sublabel}
        </p>
      )}
    </div>
  );
}
