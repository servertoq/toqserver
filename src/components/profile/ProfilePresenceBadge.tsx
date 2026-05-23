import { presenceLabel } from "@/lib/presence";

type Props = {
  lastSeenAt: string | null | undefined;
  className?: string;
};

/** Status abaixo da foto do perfil (visível para qualquer visitante autenticado). */
export function ProfilePresenceBadge({ lastSeenAt, className = "" }: Props) {
  const { online, text } = presenceLabel(lastSeenAt);

  return (
    <p
      className={`mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold sm:justify-start ${className}`}
      role="status"
    >
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${
          online ? "bg-green-500" : "bg-slate-400"
        }`}
        aria-hidden
      />
      <span className={online ? "text-green-700" : "text-[var(--toq-text-muted)]"}>
        {text}
      </span>
    </p>
  );
}
