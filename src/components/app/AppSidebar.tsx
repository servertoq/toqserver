"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { StaffRole } from "@/types/staff";

export type AppProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  staffRole: StaffRole | null;
  isBanned: boolean;
  plan: "free" | "professor" | "empresario";
  showPlanBadge: boolean;
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
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 0 : 2} aria-hidden>
        {active ? (
          <path fill="currentColor" d="M12 3l9 8v10h-6v-6H9v6H3V11l9-8z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5 10.5V20h5v-6h4v6h5v-9.5" />
        )}
      </svg>
    </NavIcon>
  );
}

function IconCommunity({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </NavIcon>
  );
}

function IconLogout() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
    </NavIcon>
  );
}

function IconPlans({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path strokeLinecap="round" d="M3 10h18M8 4v4M16 4v4" />
      </svg>
    </NavIcon>
  );
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <circle cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} />
        <path strokeLinecap="round" d="M5 20c0-3.3 2.7-6 7-6s7 2.7 7 6" fill={active ? "currentColor" : "none"} />
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4M7 4h10l1 4H6l1-4zM6 8h12v5a4 4 0 01-4 4h-4a4 4 0 01-4-4V8z" />
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

function IconModeration({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
      </svg>
    </NavIcon>
  );
}

function IconLearn({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v7" />
      </svg>
    </NavIcon>
  );
}

function IconAdvertising({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 5H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 15l3-3 2 2 4-4 3 3" />
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
    href: "/inicio/aprenda-a-jogar",
    label: "Aprenda à Jogar",
    icon: (active) => <IconLearn active={active} />,
    match: (path) => path.startsWith("/inicio/aprenda-a-jogar"),
  },
  {
    href: "/inicio/publicidade",
    label: "Publicidade",
    icon: (active) => <IconAdvertising active={active} />,
    match: (path) => path.startsWith("/inicio/publicidade"),
  },
  {
    href: "/inicio/planos",
    label: "Planos",
    icon: (active) => <IconPlans active={active} />,
    match: (path) => path.startsWith("/inicio/planos"),
  },
  {
    href: "/inicio/perfil",
    label: "Perfil",
    icon: (active) => <IconProfile active={active} />,
    match: (path) => path.startsWith("/inicio/perfil") && !path.startsWith("/inicio/jogador"),
  },
];

function ToqLogo({ className = "" }: { className?: string }) {
  return (
    <Link href="/inicio" className={`sidebar-logo ${className}`} aria-label="Toq Tennis — início">
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
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  profile: AppProfile;
  onNavigate?: () => void;
}) {
  const isProfile = item.href === "/inicio/perfil";

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
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

function LogoutButton({ onLogout }: { onLogout?: () => void }) {
  function handleLogout() {
    onLogout?.();
    window.location.replace("/auth/signout");
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

function HamburgerButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`app-hamburger ${open ? "app-hamburger--open" : ""}`}
      onClick={onClick}
      aria-label={open ? "Fechar menu" : "Abrir menu"}
      aria-expanded={open}
      aria-controls="app-mobile-drawer"
    >
      <span className="app-hamburger-line" />
      <span className="app-hamburger-line" />
      <span className="app-hamburger-line" />
    </button>
  );
}

function MobileHeader({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <header className="app-mobile-header md:hidden">
      <HamburgerButton open={open} onClick={onToggle} />
      <div className="app-mobile-header-brand">
        <Link href="/inicio" className="app-mobile-header-logo" aria-label="Toq Tennis — início">
          <Image
            src="/imagens_publicas/logo_sidebar.png"
            alt="Toq Tennis"
            width={359}
            height={122}
            priority
            className="h-7 w-auto object-contain"
          />
        </Link>
      </div>
      <div className="app-mobile-header-spacer" aria-hidden />
    </header>
  );
}

function MobileDrawer({
  profile,
  pathname,
  open,
  onClose,
  navItems,
}: {
  profile: AppProfile;
  pathname: string;
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
}) {
  return (
    <>
      <button
        type="button"
        className={`app-mobile-drawer-backdrop ${open ? "app-mobile-drawer-backdrop--open" : ""}`}
        aria-label="Fechar menu"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        id="app-mobile-drawer"
        className={`app-mobile-drawer ${open ? "app-mobile-drawer--open" : ""}`}
        aria-hidden={!open}
        inert={open ? undefined : true}
      >
        <div className="app-mobile-drawer-inner">
          <ToqLogo className="mb-6" />
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                profile={profile}
                active={item.match ? item.match(pathname) : pathname === item.href}
                onNavigate={onClose}
              />
            ))}
            <div className="mt-2 border-t border-white/15 pt-2">
              <LogoutButton onLogout={onClose} />
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}

export function AppSidebar({ profile }: { profile: AppProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = useMemo(() => {
    const items = [...NAV_ITEMS];
    if (profile.staffRole) {
      items.push({
        href: "/inicio/moderacao",
        label: "Moderação",
        icon: (active) => <IconModeration active={active} />,
        match: (path) => path.startsWith("/inicio/moderacao"),
      });
    }
    return items;
  }, [profile.staffRole]);

  useEffect(() => {
    if (profile.isBanned && !pathname.startsWith("/inicio/bloqueado")) {
      router.replace("/inicio/bloqueado");
    }
  }, [profile.isBanned, pathname, router]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) closeMenu();
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, closeMenu]);

  return (
    <>
      <aside className="app-sidebar hidden md:flex md:w-[244px] md:shrink-0 md:flex-col md:px-3 md:py-8 lg:w-[260px]">
        <ToqLogo className="mb-8" />
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
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

      <MobileHeader open={menuOpen} onToggle={toggleMenu} />
      <MobileDrawer
        profile={profile}
        pathname={pathname}
        open={menuOpen}
        onClose={closeMenu}
        navItems={navItems}
      />
    </>
  );
}
