import { redirect } from "next/navigation";
import { CoachListingForm } from "@/components/coach/CoachListingForm";
import { isProfessorPlan } from "@/lib/plans";
import { canModeratePlatform } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/types/staff";

export default async function CadastrarCoachListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [{ data: profile }, { data: staffRole }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase.rpc("get_my_staff_role"),
  ]);

  const canCreate =
    isProfessorPlan(profile?.plan) || canModeratePlatform((staffRole as StaffRole | null) ?? null);

  if (!canCreate) {
    redirect("/inicio/aprenda-a-jogar");
  }

  const { data: existing } = await supabase
    .from("coach_listings")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect(`/inicio/aprenda-a-jogar/${existing.id}/editar`);
  }

  return <CoachListingForm />;
}
