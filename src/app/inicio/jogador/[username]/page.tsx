import { Suspense } from "react";
import { PublicProfileView } from "@/components/profile/PublicProfileView";

export default async function JogadorPerfilPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
        </div>
      }
    >
      <PublicProfileView username={decodeURIComponent(username)} />
    </Suspense>
  );
}
