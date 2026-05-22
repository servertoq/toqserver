import { redirect } from "next/navigation";
import { AuthScreenLoader } from "@/components/AuthScreenLoader";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function HomePage() {
  if (!getSupabaseEnv().isConfigured) {
    return <AuthScreenLoader />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/inicio");
  }

  return <AuthScreenLoader />;
}
