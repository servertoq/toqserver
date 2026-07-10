import { redirect } from "next/navigation";
import { CoachManagementPage } from "@/components/coach/CoachManagementPage";
import { createClient } from "@/lib/supabase/server";

export default async function GestaoDeAulasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [{ data: canAccess }, { data: myListing }] = await Promise.all([
    supabase.rpc("user_can_access_coach_management"),
    supabase.from("coach_listings").select("id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!canAccess && !myListing) {
    redirect("/inicio/aprenda-a-jogar");
  }

  return <CoachManagementPage />;
}
