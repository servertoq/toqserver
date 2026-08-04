"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { AppProfile } from "./AppSidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { PresenceHeartbeat } from "@/components/feed/PresenceHeartbeat";
import { mobileMainOffsetClass } from "@/lib/responsive";

const ProfileContext = createContext<AppProfile | null>(null);
const ProfileUpdateContext = createContext<((patch: Partial<AppProfile>) => void) | null>(null);

export function useAppProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useAppProfile deve ser usado dentro de AppShell");
  return ctx;
}

/** Atualiza campos do perfil no shell (nav, amigos, sidebar) sem recarregar a página. */
export function useUpdateAppProfile() {
  const update = useContext(ProfileUpdateContext);
  if (!update) throw new Error("useUpdateAppProfile deve ser usado dentro de AppShell");
  return update;
}

export function AppShell({
  profile: initialProfile,
  children,
}: {
  profile: AppProfile;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState(initialProfile);

  const updateAppProfile = useCallback((patch: Partial<AppProfile>) => {
    setProfile((current) => ({ ...current, ...patch }));
  }, []);

  if (profile.isBanned) {
    return (
      <ProfileContext.Provider value={profile}>
        <ProfileUpdateContext.Provider value={updateAppProfile}>
          <div className="flex min-h-dvh w-full flex-col">{children}</div>
        </ProfileUpdateContext.Provider>
      </ProfileContext.Provider>
    );
  }

  return (
    <ProfileContext.Provider value={profile}>
      <ProfileUpdateContext.Provider value={updateAppProfile}>
        <PresenceHeartbeat />
        <div className="feed-layout flex">
          <AppSidebar profile={profile} />
          <div className={`feed-layout-main flex flex-col ${mobileMainOffsetClass}`}>
            {children}
          </div>
        </div>
        <MobileBottomNav />
      </ProfileUpdateContext.Provider>
    </ProfileContext.Provider>
  );
}
