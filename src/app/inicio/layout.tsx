import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
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
    .select("id, username, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
