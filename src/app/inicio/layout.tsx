import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import type { AppProfile } from "@/components/app/AppSidebar";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function InicioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getSupabaseEnv().isConfigured) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_banned, plan, show_plan_badge")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  const { data: staffRole } = await supabase.rpc("get_my_staff_role");

  return (
    <AppShell
      profile={{
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url,
        staffRole: (staffRole as AppProfile["staffRole"]) ?? null,
        isBanned: profile.is_banned ?? false,
        plan: (profile.plan as AppProfile["plan"]) ?? "free",
        showPlanBadge: profile.show_plan_badge ?? true,
      }}
    >
      {children}
    </AppShell>
  );
}
