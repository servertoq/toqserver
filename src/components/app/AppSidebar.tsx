"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { StaffRole } from "@/types/staff";
import { NotificationsBell } from "@/components/feed/NotificationsBell";

export type AppProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  staffRole: StaffRole | null;
  isBanned: boolean;
  plan: "free" | "professor" | "proprietario" | "proprietario_plus" | "empresario";
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

function IconSettings({ active }: { active: boolean }) {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} aria-hidden>
        <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
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
  {
    href: "/inicio/configuracoes",
    label: "Configurações",
    icon: (active) => <IconSettings active={active} />,
    match: (path) => path.startsWith("/inicio/configuracoes"),
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
      className={`sidebar-nav-link flex items-center gap-4 rounded-xl px-3 py-2.5 transition ${
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
      <span className="sidebar-nav-label text-[15px]">{item.label}</span>
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
      className="sidebar-nav-link flex w-full items-center gap-4 rounded-lg px-3 py-2.5 font-normal text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      <IconLogout />
      <span className="sidebar-nav-label text-[15px]">Sair</span>
    </button>
  );
}

function PlusMenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`app-plus-menu-btn ${open ? "app-plus-menu-btn--open" : ""}`}
      onClick={onClick}
      aria-label={open ? "Fechar menu" : "Abrir menu completo"}
      aria-expanded={open}
      aria-controls="app-mobile-drawer"
    >
      <span className="app-plus-menu-icon" aria-hidden />
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
      <PlusMenuButton open={open} onClick={onToggle} />
      <div className="app-mobile-header-brand">
        <Link href="/inicio" className="app-mobile-header-logo" aria-label="Toq Tennis — início">
          <span
            className="app-mobile-header-logo-mark"
            style={{
              maskImage: "url(/imagens_publicas/logo_transp.png)",
              WebkitMaskImage: "url(/imagens_publicas/logo_transp.png)",
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
            role="img"
            aria-hidden
          />
        </Link>
      </div>
      <div className="app-mobile-header-actions">
        <NotificationsBell />
      </div>
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const sidebarLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSidebar = useCallback(() => {
    if (sidebarLeaveTimer.current) {
      clearTimeout(sidebarLeaveTimer.current);
      sidebarLeaveTimer.current = null;
    }
    setSidebarExpanded(true);
  }, []);

  const closeSidebar = useCallback(() => {
    if (sidebarLeaveTimer.current) clearTimeout(sidebarLeaveTimer.current);
    sidebarLeaveTimer.current = setTimeout(() => {
      setSidebarExpanded(false);
      sidebarLeaveTimer.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarLeaveTimer.current) clearTimeout(sidebarLeaveTimer.current);
    };
  }, []);

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
      <aside
        className={`app-sidebar hidden md:flex md:shrink-0 md:flex-col ${
          sidebarExpanded ? "app-sidebar--expanded" : "app-sidebar--collapsed"
        }`}
        onMouseEnter={openSidebar}
        onMouseLeave={closeSidebar}
        aria-expanded={sidebarExpanded}
      >
        <div className="app-sidebar-logo-wrap">
          <ToqLogo />
        </div>
        <nav className="app-sidebar-nav flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              profile={profile}
              active={item.match ? item.match(pathname) : pathname === item.href}
            />
          ))}
          <div className="sidebar-nav-footer mt-1 border-t border-white/15 pt-1">
            <LogoutButton />
          </div>
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
