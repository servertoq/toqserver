import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchClubCourtDetail } from "@/lib/clubCourtBrowse";
import { ClubCourtDetailPage } from "@/components/courts/ClubCourtBrowse";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";

export default async function ClubCourtPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const court = await fetchClubCourtDetail(supabase, id, user.id);
  if (!court) redirect("/inicio/quadras");

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <ClubCourtDetailPage court={court} />
      </main>
    </>
  );
}
