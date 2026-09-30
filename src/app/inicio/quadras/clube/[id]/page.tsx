import Link from "next/link";
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
  if (!court) {
    return (
      <>
        <FeedTopBar />
        <main className={appContentClass}>
          <p className="text-sm text-[var(--toq-text-muted)]">
            Esta quadra não está disponível ou você não tem permissão para ver os detalhes.
          </p>
          <Link
            href="/inicio/quadras"
            className="mt-4 inline-block text-sm font-semibold text-[var(--toq-sky)]"
          >
            ← Voltar às quadras
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <ClubCourtDetailPage court={court} />
      </main>
    </>
  );
}
