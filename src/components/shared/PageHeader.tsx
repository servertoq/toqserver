import type { ReactNode } from "react";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function PageHeader({ kicker = "TOQ", title, subtitle, action }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker ? <p className="profile-hero-kicker">{kicker}</p> : null}
        <h1 className="profile-hero-title text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="profile-hero-sub">{subtitle}</p>}
      </div>
      {action ? <div className="w-full min-w-0 sm:w-auto">{action}</div> : null}
    </header>
  );
}
