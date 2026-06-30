import { redirect } from "next/navigation";
import { CoachListingForm } from "@/components/coach/CoachListingForm";
import { createClient } from "@/lib/supabase/server";

export default async function CadastrarCoachListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.plan !== "professor" && profile.plan !== "empresario")) {
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
