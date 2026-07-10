import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import type { AppProfile } from "@/components/app/AppSidebar";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { normalizePlan } from "@/lib/plans";

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

  const [{ data: staffRole }, { data: coachManagement }, { data: myCoachListing }] =
    await Promise.all([
      supabase.rpc("get_my_staff_role"),
      supabase.rpc("user_can_access_coach_management"),
      supabase.from("coach_listings").select("id").eq("user_id", user.id).maybeSingle(),
    ]);

  const canAccessCoachManagement =
    Boolean(coachManagement) || Boolean(myCoachListing);

  return (
    <AppShell
      profile={{
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url,
        staffRole: (staffRole as AppProfile["staffRole"]) ?? null,
        isBanned: profile.is_banned ?? false,
        plan: normalizePlan((profile.plan as AppProfile["plan"]) ?? "free"),
        showPlanBadge: profile.show_plan_badge ?? true,
        canAccessCoachManagement: Boolean(coachManagement),
      }}
    >
      {children}
    </AppShell>
  );
}
