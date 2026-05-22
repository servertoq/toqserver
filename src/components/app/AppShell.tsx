"use client";

import { createContext, useContext } from "react";
import type { AppProfile } from "./AppSidebar";
import { AppSidebar } from "./AppSidebar";

const ProfileContext = createContext<AppProfile | null>(null);

export function useAppProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useAppProfile deve ser usado dentro de AppShell");
  return ctx;
}

export function AppShell({
  profile,
  children,
}: {
  profile: AppProfile;
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>
      <div className="feed-layout flex min-h-dvh bg-slate-50">
        <AppSidebar profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col pb-16 md:ml-[244px] md:pb-0 lg:ml-[260px]">
          {children}
        </div>
      </div>
    </ProfileContext.Provider>
  );
}
