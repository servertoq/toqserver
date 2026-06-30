import { redirect } from "next/navigation";
import { CourtForm } from "@/components/courts/CourtForm";
import { createClient } from "@/lib/supabase/server";

export default async function CadastrarQuadraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: allowed } = await supabase.rpc("user_can_create_court", {
    p_user_id: user.id,
  });

  if (!allowed) {
    redirect("/inicio/quadras");
  }

  return <CourtForm />;
}
