import type { ReactNode } from "react";
import { formatNearbyAnchorHint, type UserLocationAnchor } from "@/lib/nearbyLocation";

type Props = {
  title: string;
  anchor: UserLocationAnchor | null;
  children: ReactNode;
  className?: string;
};

export function NearbySection({ title, anchor, children, className = "" }: Props) {
  const hint = formatNearbyAnchorHint(anchor);
  return (
    <section className={className}>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-[var(--toq-navy)] sm:text-base">{title}</h2>
        {hint && <p className="mt-0.5 text-[11px] text-[var(--toq-text-muted)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function OtherSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="mb-3 text-sm font-bold text-[var(--toq-navy)] sm:text-base">{title}</h2>
      {children}
    </section>
  );
}
