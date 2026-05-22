"use client";

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

function IconHome({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 2}
      className="h-6 w-6 shrink-0"
      aria-hidden
    >
      {active ? (
        <path d="M12 3l9 8v10h-6v-6H9v6H3V11l9-8z" />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 11.5 12 4l9 7.5M5 10.5V20h5v-6h4v6h5v-9.5"
        />
      )}
    </svg>
  );
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      className="h-6 w-6 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path
        strokeLinecap="round"
        d="M5 20c0-3.3 2.7-6 7-6s7 2.7 7 6"
        fill={active ? "currentColor" : "none"}
      />
    </svg>
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
    href: "/inicio/perfil",
    label: "Perfil",
    icon: (active) => <IconProfile active={active} />,
    match: (path) => path.startsWith("/inicio/perfil"),
  },
];

function ToqLogo() {
  return (
    <Link href="/inicio" className="mb-8 block px-3 py-2">
      <div
        className="h-9 w-28 bg-[var(--toq-lime-light)]"
        style={{
          maskImage: "url(/imagens_publicas/logo_transp.png)",
          WebkitMaskImage: "url(/imagens_publicas/logo_transp.png)",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "left center",
          WebkitMaskPosition: "left center",
        }}
        role="img"
        aria-label="Toq Tennis"
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
      className={`flex items-center gap-4 rounded-lg px-3 py-3 transition hover:bg-white/10 ${
        active ? "font-bold" : "font-normal"
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
        </nav>
      </aside>

      {/* Mobile — barra inferior */}
      <nav
        className="app-sidebar-mobile fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/10 bg-[var(--toq-sidebar)] px-6 py-2 md:hidden"
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
              <span className="scale-90">{item.icon(active)}</span>
              <span>{item.label === "Página inicial" ? "Início" : "Perfil"}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
