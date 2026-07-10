import { redirect } from "next/navigation";
import { CourtManagementPage } from "@/components/court/CourtManagementPage";
import { resolveCanAccessCourtManagement } from "@/lib/courtManagementAccess";
import { createClient } from "@/lib/supabase/server";
import type { AppProfile } from "@/components/app/AppSidebar";
export default async function GestaoDeQuadrasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: staffRole } = await supabase.rpc("get_my_staff_role");
  const canAccess = await resolveCanAccessCourtManagement(
    supabase,
    user.id,
    (staffRole as AppProfile["staffRole"]) ?? null
  );

  if (!canAccess) {    redirect("/inicio/quadras");
  }

  return <CourtManagementPage />;
}
