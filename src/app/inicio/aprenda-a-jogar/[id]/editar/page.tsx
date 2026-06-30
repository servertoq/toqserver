import { notFound, redirect } from "next/navigation";
import { CoachListingForm } from "@/components/coach/CoachListingForm";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function EditarCoachListingPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: listing, error } = await supabase
    .from("coach_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !listing) notFound();
  if (listing.user_id !== user.id) redirect("/inicio/aprenda-a-jogar");

  return <CoachListingForm initial={listing} />;
}
