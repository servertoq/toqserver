"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type AppProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => ReactNode;
  match?: (path: string) => boolean;
};

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden">
      {children}
    </span>
  );
}

function IconHome({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        aria-hidden
      >
        {active ? (
          <path fill="currentColor" d="M12 3l9 8v10h-6v-6H9v6H3V11l9-8z" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 11.5 12 4l9 7.5M5 10.5V20h5v-6h4v6h5v-9.5"
          />
        )}
      </svg>
    </NavIcon>
  );
}

function IconCommunity({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    </NavIcon>
  );
}

function IconLogout() {
  return (
    <NavIcon>
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
        />
      </svg>
    </NavIcon>
  );
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 2}
        aria-hidden
      >
        <circle cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} />
        <path
          strokeLinecap="round"
          d="M5 20c0-3.3 2.7-6 7-6s7 2.7 7 6"
          fill={active ? "currentColor" : "none"}
        />
      </svg>
    </NavIcon>
  );
}

function IconCourts({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path strokeLinecap="round" d="M12 3v18M3 12h18" />
      </svg>
    </NavIcon>
  );
}

function IconTournaments({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 21h8M12 17v4M7 4h10l1 4H6l1-4zM6 8h12v5a4 4 0 01-4 4h-4a4 4 0 01-4-4V8z"
        />
      </svg>
    </NavIcon>
  );
}

function IconClub({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
      </svg>
    </NavIcon>
  );
}

function IconMessages({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.8-4.2A7.8 7.8 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </NavIcon>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/inicio",
    label: "Página inicial",
    icon: (active) => <IconHome active={active} />,
    match: (path) => path === "/inicio",
  },
  {
    href: "/inicio/comunidade",
    label: "Comunidade",
    icon: (active) => <IconCommunity active={active} />,
    match: (path) => path.startsWith("/inicio/comunidade"),
  },
  {
    href: "/inicio/mensagens",
    label: "Mensagens",
    icon: (active) => <IconMessages active={active} />,
    match: (path) => path.startsWith("/inicio/mensagens") || path.startsWith("/inicio/conversar"),
  },
  {
    href: "/inicio/clubes",
    label: "Clubes",
    icon: (active) => <IconClub active={active} />,
    match: (path) => path.startsWith("/inicio/clubes"),
  },
  {
    href: "/inicio/quadras",
    label: "Quadras",
    icon: (active) => <IconCourts active={active} />,
    match: (path) => path.startsWith("/inicio/quadras"),
  },
  {
    href: "/inicio/torneios",
    label: "Torneios",
    icon: (active) => <IconTournaments active={active} />,
    match: (path) => path.startsWith("/inicio/torneios"),
  },
  {
    href: "/inicio/perfil",
    label: "Perfil",
    icon: (active) => <IconProfile active={active} />,
    match: (path) =>
      path.startsWith("/inicio/perfil") && !path.startsWith("/inicio/jogador"),
  },
];

function ToqLogo() {
  return (
    <Link href="/inicio" className="sidebar-logo mb-8" aria-label="Toq Tennis — início">
      <Image
        src="/imagens_publicas/logo_sidebar.png"
        alt="Toq Tennis"
        width={359}
        height={122}
        priority
        className="sidebar-logo-img"
      />
    </Link>
  );
}

function NavLink({
  item,
  active,
  profile,
}: {
  item: NavItem;
  active: boolean;
  profile: AppProfile;
}) {
  const isProfile = item.href === "/inicio/perfil";

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-4 rounded-xl px-3 py-3 transition ${
        active
          ? "sidebar-nav-active font-bold"
          : "font-normal text-white/85 hover:bg-white/12 hover:text-white"
      }`}
    >
      {isProfile && profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt=""
          className={`h-6 w-6 shrink-0 rounded-full object-cover ring-2 ${
            active ? "ring-white" : "ring-transparent"
          }`}
        />
      ) : (
        item.icon(active)
      )}
      <span className="text-[15px]">{item.label}</span>
    </Link>
  );
}

function LogoutButton({ compact }: { compact?: boolean }) {
  function handleLogout() {
    window.location.replace("/auth/signout");
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-medium text-white/70"
        aria-label="Sair"
      >
        <IconLogout />
        <span>Sair</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-4 rounded-lg px-3 py-3 font-normal text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      <IconLogout />
      <span className="text-[15px]">Sair</span>
    </button>
  );
}

export function AppSidebar({ profile }: { profile: AppProfile }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop — lateral */}
      <aside className="app-sidebar hidden md:flex md:w-[244px] md:shrink-0 md:flex-col md:px-3 md:py-8 lg:w-[260px]">
        <ToqLogo />
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              profile={profile}
              active={item.match ? item.match(pathname) : pathname === item.href}
            />
          ))}
          <LogoutButton />
        </nav>
      </aside>

      {/* Mobile — barra inferior */}
      <nav
        className="app-sidebar-mobile fixed bottom-0 left-0 right-0 z-40 flex px-6 py-2 md:hidden"
        aria-label="Menu principal"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.match ? item.match(pathname) : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] ${
                active ? "font-bold text-white" : "font-medium text-white/70"
              }`}
            >
              {item.icon(active)}
              <span>
                {item.label === "Página inicial"
                  ? "Início"
                  : item.label === "Comunidade"
                    ? "Comunidade"
                    : item.label === "Mensagens"
                      ? "Msgs"
                      : item.label === "Clubes"
                        ? "Clubes"
                        : item.label === "Quadras"
                          ? "Quadras"
                          : item.label === "Torneios"
                            ? "Torneios"
                            : "Perfil"}
              </span>
            </Link>
          );
        })}
        <LogoutButton compact />
      </nav>
    </>
  );
}
