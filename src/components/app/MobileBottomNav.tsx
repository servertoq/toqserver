"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAppProfile } from "./AppShell";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type TabItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: (active: boolean) => ReactNode;
};

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center">{children}</span>
  );
}

function IconHome({ active }: { active: boolean }) {
  return (
    <TabIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 0 : 2}>
        {active ? (
          <path fill="currentColor" d="M12 3l9 8v10h-6v-6H9v6H3V11l9-8z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5 10.5V20h5v-6h4v6h5v-9.5" />
        )}
      </svg>
    </TabIcon>
  );
}

function IconClub({ active }: { active: boolean }) {
  return (
    <TabIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
      </svg>
    </TabIcon>
  );
}

function IconMessages({ active }: { active: boolean }) {
  return (
    <TabIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.8-4.2A7.8 7.8 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </TabIcon>
  );
}

function IconSearch({ active }: { active: boolean }) {
  return (
    <TabIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M20 20l-3-3" />
      </svg>
    </TabIcon>
  );
}

const TABS: TabItem[] = [
  {
    href: "/inicio",
    label: "Início",
    icon: (active) => <IconHome active={active} />,
    match: (path) => path === "/inicio",
  },
  {
    href: "/inicio/clubes",
    label: "Clubes",
    icon: (active) => <IconClub active={active} />,
    match: (path) => path.startsWith("/inicio/clubes"),
  },
  {
    href: "/inicio/mensagens",
    label: "Mensagens",
    icon: (active) => <IconMessages active={active} />,
    match: (path) =>
      path.startsWith("/inicio/mensagens") || path.startsWith("/inicio/conversar"),
  },
  {
    href: "/inicio/buscar",
    label: "Buscar",
    icon: (active) => <IconSearch active={active} />,
    match: (path) => path.startsWith("/inicio/buscar"),
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const profile = useAppProfile();

  return (
    <nav className="app-mobile-bottom-nav md:hidden" aria-label="Navegação principal">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`app-mobile-bottom-nav-item ${active ? "app-mobile-bottom-nav-item--active" : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={tab.label}
          >
            {tab.icon(active)}
          </Link>
        );
      })}
      <Link
        href="/inicio/perfil"
        className={`app-mobile-bottom-nav-item ${
          pathname.startsWith("/inicio/perfil") && !pathname.startsWith("/inicio/jogador")
            ? "app-mobile-bottom-nav-item--active"
            : ""
        }`}
        aria-label="Perfil"
        aria-current={
          pathname.startsWith("/inicio/perfil") && !pathname.startsWith("/inicio/jogador")
            ? "page"
            : undefined
        }
      >
        <ProfileAvatar
          src={profile.avatar_url}
          name={profile.username}
          size="sm"
          className={
            pathname.startsWith("/inicio/perfil") && !pathname.startsWith("/inicio/jogador")
              ? "ring-2 ring-[var(--toq-navy)]"
              : ""
          }
        />
      </Link>
    </nav>
  );
}
