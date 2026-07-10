import { redirect } from "next/navigation";
import { CourtForm } from "@/components/courts/CourtForm";
import { canModeratePlatform } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/types/staff";

export default async function CadastrarQuadraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [{ data: allowed }, { data: staffRole }] = await Promise.all([
    supabase.rpc("user_can_create_court", { p_user_id: user.id }),
    supabase.rpc("get_my_staff_role"),
  ]);

  if (!allowed && !canModeratePlatform((staffRole as StaffRole | null) ?? null)) {
    redirect("/inicio/quadras");
  }

  return <CourtForm />;
}
