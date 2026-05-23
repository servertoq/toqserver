import { Suspense } from "react";
import { CommunityDetailPage } from "@/components/community/CommunityDetailPage";

export default async function ClubeSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
        </div>
      }
    >
      <CommunityDetailPage slug={slug} groupKind="club" />
    </Suspense>
  );
}
