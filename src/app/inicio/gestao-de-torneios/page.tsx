import { redirect } from "next/navigation";
import { PromoterManagementPage } from "@/components/promoter/PromoterManagementPage";
import { isPromotorPlan } from "@/lib/plans";
import { canModeratePlatform } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/types/staff";
import type { UserPlan } from "@/types/plans";

export default async function GestaoDeTorneiosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [{ data: canAccess }, { data: profile }, { data: staffRole }] = await Promise.all([
    supabase.rpc("user_can_access_promoter_management"),
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase.rpc("get_my_staff_role"),
  ]);

  const allowed =
    Boolean(canAccess) ||
    isPromotorPlan(profile?.plan as UserPlan) ||
    canModeratePlatform((staffRole as StaffRole | null) ?? null);

  if (!allowed) {
    redirect("/inicio/torneios");
  }

  return <PromoterManagementPage />;
}
