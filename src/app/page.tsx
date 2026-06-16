import { redirect } from "next/navigation";
import { AuthScreenLoader } from "@/components/AuthScreenLoader";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
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
    redirect("/inicio");
  }

  return <AuthScreenLoader />;
}
