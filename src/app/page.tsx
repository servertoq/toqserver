import { redirect } from "next/navigation";
import { AuthScreenLoader } from "@/components/AuthScreenLoader";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; complete?: string }>;
}) {
  if (!getSupabaseEnv().isConfigured) {
    return <AuthScreenLoader />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && params.reset !== "1") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_complete, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_banned) {
      redirect("/inicio/bloqueado");
    }

    if (profile && profile.profile_complete === false) {
      if (params.complete !== "1") {
        redirect("/?complete=1");
      }
      return <AuthScreenLoader />;
    }

    redirect("/inicio");
  }

  return <AuthScreenLoader />;
}
