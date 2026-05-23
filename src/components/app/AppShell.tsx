"use client";

import { createContext, useContext } from "react";
import type { AppProfile } from "./AppSidebar";
import { AppSidebar } from "./AppSidebar";
import { PresenceHeartbeat } from "@/components/feed/PresenceHeartbeat";
import { FloatingMessages } from "@/components/messages/FloatingMessages";

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
      <PresenceHeartbeat />
      <div className="feed-layout flex bg-slate-50">
        <AppSidebar profile={profile} />
        <div className="feed-layout-main flex w-full flex-col pb-16 md:ml-[244px] md:pb-0 lg:ml-[260px]">
          {children}
          <FloatingMessages />
        </div>
      </div>
    </ProfileContext.Provider>
  );
}
