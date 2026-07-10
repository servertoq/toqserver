import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppProfile } from "@/components/app/AppSidebar";

const STAFF_WITH_COURT_ACCESS = new Set<NonNullable<AppProfile["staffRole"]>>([
  "ceo",
  "cto",
  "moderator",
]);

/** Menu Gestão de Quadras: dono ou moderador de clube, dono de quadra avulsa ou staff. */
export async function resolveCanAccessCourtManagement(
  supabase: SupabaseClient,
  userId: string,
  staffRole: AppProfile["staffRole"]
): Promise<boolean> {
  const { data: rpcAccess, error } = await supabase.rpc("user_can_access_court_management");
  if (!error && rpcAccess) return true;

  if (staffRole && STAFF_WITH_COURT_ACCESS.has(staffRole)) return true;

  const [{ data: modMemberships }, { data: ownCourts }] = await Promise.all([
    supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId)
      .in("role", ["owner", "moderator"])
      .limit(1),
    supabase.from("courts").select("id").eq("owner_id", userId).limit(1),
  ]);

  return (modMemberships?.length ?? 0) > 0 || (ownCourts?.length ?? 0) > 0;
}
