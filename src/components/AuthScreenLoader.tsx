"use client";

import dynamic from "next/dynamic";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { SupabaseConfigMissing } from "./SupabaseConfigMissing";

const AuthScreen = dynamic(
  () => import("./AuthScreen").then((m) => m.AuthScreen),
  {
    ssr: false,
    loading: () => (
      <main className="auth-panel-login flex h-dvh items-center justify-center">
        <p className="text-sm text-[var(--toq-muted)]">Carregando…</p>
      </main>
    ),
  }
);

export function AuthScreenLoader() {
  if (!getSupabaseEnv().isConfigured) {
    return <SupabaseConfigMissing />;
  }

  return <AuthScreen />;
}
