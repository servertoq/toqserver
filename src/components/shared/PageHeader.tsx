import type { ReactNode } from "react";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function PageHeader({ kicker = "TOQ", title, subtitle, action }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? <p className="profile-hero-kicker">{kicker}</p> : null}
        <h1 className="profile-hero-title text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="profile-hero-sub">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
